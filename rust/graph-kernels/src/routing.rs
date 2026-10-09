//! Batched numeric edge-routing work. Graph identities and resumable scheduling
//! stay in TypeScript; a candidate is scored in one Wasm call.

use crate::numeric::hypot;
use std::slice;

#[derive(Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
}
#[derive(Clone, Copy)]
struct Segment {
    start: Point,
    control: Point,
    end: Point,
}
struct Piece {
    start: Point,
    end: Point,
    error: f64,
    dx: f64,
    dy: f64,
    denominator: f64,
    min_x: f64,
    max_x: f64,
    min_y: f64,
    max_y: f64,
    coordinate_scale: f64,
}
impl Piece {
    fn new(start: Point, end: Point, error: f64) -> Self {
        let dx = end.x - start.x;
        let dy = end.y - start.y;
        let squared = dx * dx + dy * dy;
        Self {
            start,
            end,
            error,
            dx,
            dy,
            denominator: if squared == 0.0 { 1.0 } else { squared },
            min_x: start.x.min(end.x),
            max_x: start.x.max(end.x),
            min_y: start.y.min(end.y),
            max_y: start.y.max(end.y),
            coordinate_scale: 1.0_f64
                .max(start.x.abs())
                .max(start.y.abs())
                .max(end.x.abs())
                .max(end.y.abs()),
        }
    }

    fn point_distance(&self, point: Point) -> f64 {
        let t = (((point.x - self.start.x) * self.dx + (point.y - self.start.y) * self.dy)
            / self.denominator)
            .max(0.0)
            .min(1.0);
        hypot(
            point.x - self.start.x - t * self.dx,
            point.y - self.start.y - t * self.dy,
        )
    }

    // The L-infinity gap between the segment's AABB and a horizontal capsule
    // spine is a lower bound on their Euclidean distance. Keep a rounding guard
    // so a near-equality still executes the original distance calculation.
    fn cannot_improve(&self, left: Point, right: Point, minimum: f64) -> bool {
        let x_gap = (left.x - self.max_x).max(self.min_x - right.x).max(0.0);
        let y_gap = (left.y - self.max_y).max(self.min_y - left.y).max(0.0);
        let scale = self
            .coordinate_scale
            .max(left.x.abs())
            .max(right.x.abs())
            .max(left.y.abs())
            .max(minimum.abs())
            .max(self.error.abs());
        let guard = 1e-9_f64.max(f64::EPSILON * scale * 64.0);
        x_gap.max(y_gap) - self.error > minimum + guard
    }

    fn capsule_distance(&self, left: Point, right: Point, denominator: f64) -> f64 {
        if self.dy != 0.0 {
            let t = (left.y - self.start.y) / self.dy;
            let x = self.start.x + t * self.dx;
            if t >= 0.0 && t <= 1.0 && x >= left.x && x <= right.x {
                return 0.0;
            }
        }
        let spine_distance = |point: Point| {
            let dx = right.x - left.x;
            let t = (((point.x - left.x) * dx + (point.y - left.y) * 0.0) / denominator)
                .max(0.0)
                .min(1.0);
            hypot(point.x - left.x - t * dx, point.y - left.y - t * 0.0)
        };
        let endpoints = spine_distance(self.start).min(spine_distance(self.end));
        let from_left = self.point_distance(left);
        if left.x == right.x {
            // Circular nodes have identical spine endpoints. The former fourth
            // distance was exactly the same operation on the same point.
            endpoints.min(from_left)
        } else {
            endpoints.min(from_left).min(self.point_distance(right))
        }
    }
}

struct Curve<'a> {
    distances: &'a [f64],
    weights: &'a [f64],
}
impl<'a> Curve<'a> {
    unsafe fn from_ptr(ptr: *const f64) -> Self {
        let distances_len = *ptr as usize;
        let weights_len = *ptr.add(1) as usize;
        Self {
            distances: slice::from_raw_parts(ptr.add(2), distances_len),
            weights: slice::from_raw_parts(ptr.add(2 + distances_len), weights_len),
        }
    }

    fn segments(&self, source: Point, target: Point) -> Vec<Segment> {
        let dx = target.x - source.x;
        let dy = target.y - source.y;
        let length = hypot(dx, dy);
        let nx = if length == 0.0 { 0.0 } else { -dy / length };
        let ny = if length == 0.0 { 0.0 } else { dx / length };
        let count = self.distances.len().min(self.weights.len());
        let controls: Vec<Point> = (0..count)
            .map(|i| Point {
                x: source.x + dx * self.weights[i] + nx * self.distances[i],
                y: source.y + dy * self.weights[i] + ny * self.distances[i],
            })
            .collect();
        (0..count)
            .map(|i| Segment {
                start: if i == 0 {
                    source
                } else {
                    midpoint(controls[i - 1], controls[i])
                },
                control: controls[i],
                end: if i + 1 == count {
                    target
                } else {
                    midpoint(controls[i], controls[i + 1])
                },
            })
            .collect()
    }

    fn maximum_offset(&self) -> f64 {
        self.distances
            .iter()
            .fold(0.0, |value, distance| value.max(distance.abs()))
    }

    fn zigzag(&self) -> f64 {
        let mut score = 0.0;
        for pair in self.distances.windows(2) {
            if sign(pair[0]) != sign(pair[1]) {
                score += (pair[0] - pair[1]).abs() * 2.0;
            }
        }
        score
    }
}

fn sign(value: f64) -> f64 {
    if value == 0.0 {
        0.0
    } else {
        value.signum()
    }
}
fn midpoint(a: Point, b: Point) -> Point {
    Point {
        x: (a.x + b.x) / 2.0,
        y: (a.y + b.y) / 2.0,
    }
}
fn quadratic_point(segment: Segment, t: f64) -> Point {
    let u = 1.0 - t;
    Point {
        x: u * u * segment.start.x + 2.0 * u * t * segment.control.x + t * t * segment.end.x,
        y: u * u * segment.start.y + 2.0 * u * t * segment.control.y + t * t * segment.end.y,
    }
}
fn samples(segments: &[Segment], source: Point, target: Point, per_segment: usize) -> Vec<Point> {
    if segments.is_empty() {
        return vec![source, target];
    }
    let mut points = Vec::with_capacity(segments.len() * per_segment + 1);
    for (index, segment) in segments.iter().enumerate() {
        for i in if index == 0 { 0 } else { 1 }..=per_segment {
            points.push(quadratic_point(*segment, i as f64 / per_segment as f64));
        }
    }
    points
}
fn point_segment_distance(p: Point, a: Point, b: Point) -> f64 {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let squared = dx * dx + dy * dy;
    let denominator = if squared == 0.0 { 1.0 } else { squared };
    let t = (((p.x - a.x) * dx + (p.y - a.y) * dy) / denominator)
        .max(0.0)
        .min(1.0);
    hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
#[cfg(test)]
fn segment_distance(a: Point, b: Point, c: Point, d: Point) -> f64 {
    if a.y != b.y {
        let t = (c.y - a.y) / (b.y - a.y);
        let x = a.x + t * (b.x - a.x);
        if t >= 0.0 && t <= 1.0 && x >= c.x && x <= d.x {
            return 0.0;
        }
    }
    point_segment_distance(a, c, d)
        .min(point_segment_distance(b, c, d))
        .min(point_segment_distance(c, a, b))
        .min(point_segment_distance(d, a, b))
}
fn subdivide(segment: Segment, depth: usize, pieces: &mut Vec<Piece>) {
    let error = point_segment_distance(segment.control, segment.start, segment.end) / 2.0;
    if error <= 0.25 || depth >= 16 {
        pieces.push(Piece::new(segment.start, segment.end, error));
        return;
    }
    let a = midpoint(segment.start, segment.control);
    let b = midpoint(segment.end, segment.control);
    let mid = midpoint(a, b);
    subdivide(
        Segment {
            start: segment.start,
            control: a,
            end: mid,
        },
        depth + 1,
        pieces,
    );
    subdivide(
        Segment {
            start: mid,
            control: b,
            end: segment.end,
        },
        depth + 1,
        pieces,
    );
}

/// The JS host's hypot can round an adaptive split tie differently. Only the
/// final collision operation needs strict count compatibility at that tie.
fn subdivide_final_route(
    segment: Segment,
    depth: usize,
    pieces: &mut Vec<Piece>,
    tolerance: f64,
) -> bool {
    let error = point_segment_distance(segment.control, segment.start, segment.end) / 2.0;
    let ambiguous = (error - 0.25).abs() <= tolerance || !error.is_finite();
    if error <= 0.25 || depth >= 16 {
        pieces.push(Piece::new(segment.start, segment.end, error));
        return ambiguous;
    }
    let a = midpoint(segment.start, segment.control);
    let b = midpoint(segment.end, segment.control);
    let mid = midpoint(a, b);
    let first = subdivide_final_route(
        Segment {
            start: segment.start,
            control: a,
            end: mid,
        },
        depth + 1,
        pieces,
        tolerance,
    );
    let second = subdivide_final_route(
        Segment {
            start: mid,
            control: b,
            end: segment.end,
        },
        depth + 1,
        pieces,
        tolerance,
    );
    ambiguous || first || second
}
fn curve_midpoint(segments: &[Segment], source: Point, target: Point) -> Point {
    let points = samples(segments, source, target, 16);
    let mut lengths = Vec::with_capacity(points.len() - 1);
    let mut total = 0.0;
    for pair in points.windows(2) {
        total += hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y);
        lengths.push(total);
    }
    let target_length = total / 2.0;
    if let Some(i) = lengths.iter().position(|length| *length >= target_length) {
        let previous = if i == 0 { 0.0 } else { lengths[i - 1] };
        let segment_length = lengths[i] - previous;
        let ratio = if segment_length == 0.0 {
            0.0
        } else {
            (target_length - previous) / segment_length
        };
        Point {
            x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
            y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
        }
    } else {
        midpoint(source, target)
    }
}

/// nodes = [x,y,half_width]*N; curve = [distance_count,weight_count,distances...,weights...].
/// output = [collisions,score,work_units]. Source/target indices can be -1.
#[no_mangle]
pub unsafe extern "C" fn routing_node_shape(
    nodes_ptr: *const f64,
    curve_ptr: *const f64,
    output_ptr: *mut f64,
    node_count: usize,
    source_index: f64,
    target_index: f64,
    sx: f64,
    sy: f64,
    tx: f64,
    ty: f64,
    clearance: f64,
) {
    let nodes = slice::from_raw_parts(nodes_ptr, node_count * 3);
    let curve = Curve::from_ptr(curve_ptr);
    let source = Point { x: sx, y: sy };
    let target = Point { x: tx, y: ty };
    let segments = curve.segments(source, target);
    let mut pieces = Vec::new();
    for segment in &segments {
        subdivide(*segment, 0, &mut pieces);
    }
    let offset = curve.maximum_offset();
    let reach = offset + clearance + 120.0;
    let min_x = sx.min(tx) - reach;
    let max_x = sx.max(tx) + reach;
    let min_y = sy.min(ty) - reach;
    let max_y = sy.max(ty) + reach;
    let mut collisions = 0.0;
    let mut penetration = 0.0;
    let mut units = 0.0;
    for (i, node) in nodes.chunks_exact(3).enumerate() {
        if i as f64 == source_index || i as f64 == target_index {
            continue;
        }
        if node[0] + node[2] < min_x
            || node[0] - node[2] > max_x
            || node[1] < min_y
            || node[1] > max_y
        {
            continue;
        }
        units += 1.0;
        let span = (node[2] - 24.0).max(0.0);
        let left = Point {
            x: node[0] - span,
            y: node[1],
        };
        let right = Point {
            x: node[0] + span,
            y: node[1],
        };
        let spine_width = right.x - left.x;
        let spine_squared = spine_width * spine_width;
        let spine_denominator = if spine_squared == 0.0 {
            1.0
        } else {
            spine_squared
        };
        let mut minimum = clearance;
        for piece in &pieces {
            if !piece.cannot_improve(left, right, minimum) {
                minimum = minimum
                    .min(piece.capsule_distance(left, right, spine_denominator) - piece.error);
            }
        }
        let overlap = (clearance - minimum).max(0.0);
        if overlap > 0.0 {
            collisions += 1.0;
            penetration += overlap * overlap;
        }
    }
    let points = samples(&segments, source, target, 12);
    let mut length = 0.0;
    for pair in points.windows(2) {
        length += hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y);
    }
    let extra = (length - hypot(tx - sx, ty - sy)).max(0.0);
    let out = slice::from_raw_parts_mut(output_ptr, 3);
    out[0] = collisions;
    out[1] = collisions * 1_000_000.0
        + penetration * 1_000.0
        + extra * 0.2
        + offset * 0.03
        + curve.weights.len() as f64 * 0.4
        + curve.zigzag();
    out[2] = units;
}

/// Final-route collision checks use a tighter pruning box than candidate
/// scoring. Keep its 48px reach and 30px distance threshold independent of
/// the configurable candidate clearance. output = [collision_count,work_units,
/// needs_js_reference]. Rare hypot/split ties defer to JS's strict comparison.
#[no_mangle]
pub unsafe extern "C" fn routing_node_collisions(
    nodes_ptr: *const f64,
    curve_ptr: *const f64,
    output_ptr: *mut f64,
    node_count: usize,
    source_index: f64,
    target_index: f64,
    sx: f64,
    sy: f64,
    tx: f64,
    ty: f64,
) {
    let nodes = slice::from_raw_parts(nodes_ptr, node_count * 3);
    let curve = Curve::from_ptr(curve_ptr);
    let source = Point { x: sx, y: sy };
    let target = Point { x: tx, y: ty };
    let coordinate_scale = 1.0_f64
        .max(sx.abs())
        .max(sy.abs())
        .max(tx.abs())
        .max(ty.abs())
        .max(curve.maximum_offset());
    let tolerance = 1e-7_f64.max(f64::EPSILON * coordinate_scale * 32.0);
    let mut needs_js = false;
    let mut pieces = Vec::new();
    for segment in curve.segments(source, target) {
        needs_js |= subdivide_final_route(segment, 0, &mut pieces, tolerance);
    }
    let reach = curve.maximum_offset() + 48.0;
    let min_x = sx.min(tx) - reach;
    let max_x = sx.max(tx) + reach;
    let min_y = sy.min(ty) - reach;
    let max_y = sy.max(ty) + reach;
    let mut collisions = 0.0;
    let mut units = 0.0;
    for (i, node) in nodes.chunks_exact(3).enumerate() {
        if i as f64 == source_index || i as f64 == target_index {
            continue;
        }
        if node[0] + node[2] < min_x
            || node[0] - node[2] > max_x
            || node[1] < min_y
            || node[1] > max_y
        {
            continue;
        }
        units += 1.0;
        let span = (node[2] - 24.0).max(0.0);
        let left = Point {
            x: node[0] - span,
            y: node[1],
        };
        let right = Point {
            x: node[0] + span,
            y: node[1],
        };
        let node_scale = coordinate_scale
            .max(node[0].abs())
            .max(node[1].abs())
            .max(node[2].abs());
        let tolerance = 1e-7_f64.max(f64::EPSILON * node_scale * 32.0);
        // Distances above this limit cannot collide or trigger the existing
        // ambiguity fallback. Preserve all calculations within that band.
        let mut minimum = 30.0 + tolerance * 2.0;
        let spine_width = right.x - left.x;
        let spine_squared = spine_width * spine_width;
        let spine_denominator = if spine_squared == 0.0 {
            1.0
        } else {
            spine_squared
        };
        for piece in &pieces {
            if !piece.cannot_improve(left, right, minimum) {
                minimum = minimum
                    .min(piece.capsule_distance(left, right, spine_denominator) - piece.error);
            }
        }
        if (minimum - 30.0).abs() <= tolerance || (!pieces.is_empty() && !minimum.is_finite()) {
            needs_js = true;
        }
        if minimum < 30.0 {
            collisions += 1.0;
        }
    }
    let out = slice::from_raw_parts_mut(output_ptr, 3);
    out[0] = collisions;
    out[1] = units;
    out[2] = if needs_js && units > 0.0 { 1.0 } else { 0.0 };
}

/// labels = [anchor_x,anchor_y,width,height]*N.
#[no_mangle]
pub unsafe extern "C" fn routing_label_overlap(
    curve_ptr: *const f64,
    labels_ptr: *const f64,
    output_ptr: *mut f64,
    label_count: usize,
    sx: f64,
    sy: f64,
    tx: f64,
    ty: f64,
    width: f64,
    height: f64,
) {
    let curve = Curve::from_ptr(curve_ptr);
    let source = Point { x: sx, y: sy };
    let target = Point { x: tx, y: ty };
    let anchor = curve_midpoint(&curve.segments(source, target), source, target);
    let labels = slice::from_raw_parts(labels_ptr, label_count * 4);
    let mut score = 0.0;
    for label in labels.chunks_exact(4) {
        let x = (width + label[2]) / 2.0 + 2.0 - (anchor.x - label[0]).abs();
        let y = (height + label[3]) / 2.0 + 2.0 - (anchor.y - label[1]).abs();
        if x > 0.0 && y > 0.0 {
            score += 10_000.0 + x * y * 1.4;
        }
    }
    *output_ptr = score;
}

/// Loop points retain JS trigonometry. Process all numeric obstacles together;
/// the existing generator consumes results at its original yield boundaries.
/// output = [overlap_score,work_units,collision_count]*N, preserving JS's sum
/// order and generator work accounting even when each chunk is computed ahead.
/// A -1 in the first collision slot requests the JS reference for the entire
/// batch when hypot rounding could change a strict clearance comparison.
/// # Safety
/// The caller supplies separate live buffers for node_count triples,
/// point_count pairs and node_count output triples. The host bounds numerical
/// inputs to avoid overflow in the clearance comparison and rounding guard.
#[no_mangle]
pub unsafe extern "C" fn routing_loop_obstacles(
    nodes_ptr: *const f64,
    points_ptr: *const f64,
    output_ptr: *mut f64,
    node_count: usize,
    point_count: usize,
    clearance: f64,
    min_x: f64,
    min_y: f64,
    max_x: f64,
    max_y: f64,
    pill_nodes: u32,
) {
    let nodes = slice::from_raw_parts(nodes_ptr, node_count * 3);
    let points = slice::from_raw_parts(points_ptr, point_count * 2);
    let out = slice::from_raw_parts_mut(output_ptr, node_count * 3);
    let point_scale = points
        .iter()
        .fold(1.0_f64, |scale, coordinate| scale.max(coordinate.abs()));
    let mut needs_js = false;
    for (index, node) in nodes.chunks_exact(3).enumerate() {
        let mut score = 0.0;
        let mut units = 0.0;
        let mut collisions = 0.0;
        if pill_nodes == 0 {
            units += 1.0;
        }
        if !(node[0] < min_x || node[0] > max_x || node[1] < min_y || node[1] > max_y) {
            let span = if pill_nodes != 0 {
                (node[2] - 24.0).max(0.0)
            } else {
                0.0
            };
            let scale = point_scale
                .max(node[0].abs())
                .max(node[1].abs())
                .max(span)
                .max(clearance.abs());
            let tolerance = 1e-7_f64.max(f64::EPSILON * scale * 32.0);
            // Only distances below clearance contribute a score or collision.
            // Retain a wider band for the strict-threshold rounding fallback.
            let mut distance = clearance + tolerance * 2.0;
            for point in points.chunks_exact(2) {
                units += 1.0;
                let dx = if pill_nodes != 0 {
                    ((point[0] - node[0]).abs() - span).max(0.0)
                } else {
                    node[0] - point[0]
                };
                let dy = node[1] - point[1];
                // L-infinity is a conservative lower bound on the exact norm.
                // Still count every original sample, including rejected ones.
                if dx.abs().max(dy.abs()) <= distance + tolerance {
                    distance = distance.min(hypot(dx, dy));
                }
            }
            needs_js |= (distance - clearance).abs() <= tolerance;
            let overlap = (clearance - distance).max(0.0);
            score = overlap * overlap;
            if distance < clearance {
                collisions = 1.0;
            }
        }
        out[index * 3] = score;
        out[index * 3 + 1] = units;
        out[index * 3 + 2] = collisions;
    }
    if needs_js && node_count > 0 {
        out[2] = -1.0;
    }
}

#[cfg(test)]
mod collision_tests {
    use super::{
        hypot, routing_node_collisions, routing_node_shape, samples, segment_distance, subdivide,
        subdivide_final_route, Curve, Point,
    };

    fn reference(
        nodes: &[f64],
        curve_data: &[f64],
        source: Point,
        target: Point,
        clearance: f64,
        final_route: bool,
    ) -> [f64; 3] {
        let curve = unsafe { Curve::from_ptr(curve_data.as_ptr()) };
        let segments = curve.segments(source, target);
        let offset = curve.maximum_offset();
        let coordinate_scale = 1.0_f64
            .max(source.x.abs())
            .max(source.y.abs())
            .max(target.x.abs())
            .max(target.y.abs())
            .max(offset);
        let tolerance = 1e-7_f64.max(f64::EPSILON * coordinate_scale * 32.0);
        let mut pieces = Vec::new();
        let mut needs_js = false;
        for segment in &segments {
            if final_route {
                needs_js |= subdivide_final_route(*segment, 0, &mut pieces, tolerance);
            } else {
                subdivide(*segment, 0, &mut pieces);
            }
        }
        let reach = offset + if final_route { 48.0 } else { clearance + 120.0 };
        let min_x = source.x.min(target.x) - reach;
        let max_x = source.x.max(target.x) + reach;
        let min_y = source.y.min(target.y) - reach;
        let max_y = source.y.max(target.y) + reach;
        let mut collisions = 0.0;
        let mut penetration = 0.0;
        let mut units = 0.0;
        for node in nodes.chunks_exact(3) {
            if node[0] + node[2] < min_x
                || node[0] - node[2] > max_x
                || node[1] < min_y
                || node[1] > max_y
            {
                continue;
            }
            units += 1.0;
            let span = (node[2] - 24.0).max(0.0);
            let left = Point {
                x: node[0] - span,
                y: node[1],
            };
            let right = Point {
                x: node[0] + span,
                y: node[1],
            };
            let mut minimum = f64::INFINITY;
            for piece in &pieces {
                minimum = minimum
                    .min(segment_distance(piece.start, piece.end, left, right) - piece.error);
            }
            if final_route {
                let node_scale = coordinate_scale
                    .max(node[0].abs())
                    .max(node[1].abs())
                    .max(node[2].abs());
                let tolerance = 1e-7_f64.max(f64::EPSILON * node_scale * 32.0);
                if (minimum - 30.0).abs() <= tolerance
                    || (!pieces.is_empty() && !minimum.is_finite())
                {
                    needs_js = true;
                }
                if minimum < 30.0 {
                    collisions += 1.0;
                }
            } else {
                let overlap = (clearance - minimum).max(0.0);
                if overlap > 0.0 {
                    collisions += 1.0;
                    penetration += overlap * overlap;
                }
            }
        }
        if final_route {
            [
                collisions,
                units,
                if needs_js && units > 0.0 { 1.0 } else { 0.0 },
            ]
        } else {
            let points = samples(&segments, source, target, 12);
            let mut length = 0.0;
            for pair in points.windows(2) {
                length += hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y);
            }
            let extra = (length - hypot(target.x - source.x, target.y - source.y)).max(0.0);
            [
                collisions,
                collisions * 1_000_000.0
                    + penetration * 1_000.0
                    + extra * 0.2
                    + offset * 0.03
                    + curve.weights.len() as f64 * 0.4
                    + curve.zigzag(),
                units,
            ]
        }
    }

    #[test]
    fn prepared_distances_and_guarded_rejection_match_original_bits() {
        let mut state = 731_u64;
        let mut random = || {
            state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
            (state >> 11) as f64 / (1_u64 << 53) as f64
        };
        for shift in [0.0, -1e9, 1e12] {
            for fixture in 0..48 {
                let source = Point {
                    x: shift - 160.0,
                    y: shift - 80.0,
                };
                let target = if fixture % 11 == 0 {
                    source
                } else {
                    Point {
                        x: shift + 160.0,
                        y: shift + 80.0,
                    }
                };
                let count = fixture % 5;
                let mut curve = vec![count as f64, count as f64];
                for _ in 0..count {
                    curve.push(random() * 640.0 - 320.0);
                }
                for index in 0..count {
                    curve.push((index + 1) as f64 / (count + 1) as f64);
                }
                let mut nodes = Vec::new();
                for index in 0..72 {
                    nodes.extend([
                        shift + random() * 900.0 - 450.0,
                        shift + random() * 700.0 - 350.0,
                        if index % 3 == 0 {
                            24.0
                        } else {
                            24.0 + random() * 100.0
                        },
                    ]);
                }
                for final_route in [false, true] {
                    let expected = reference(&nodes, &curve, source, target, 30.0, final_route);
                    let mut actual = [0.0; 3];
                    unsafe {
                        if final_route {
                            routing_node_collisions(
                                nodes.as_ptr(),
                                curve.as_ptr(),
                                actual.as_mut_ptr(),
                                nodes.len() / 3,
                                -1.0,
                                -1.0,
                                source.x,
                                source.y,
                                target.x,
                                target.y,
                            );
                        } else {
                            routing_node_shape(
                                nodes.as_ptr(),
                                curve.as_ptr(),
                                actual.as_mut_ptr(),
                                nodes.len() / 3,
                                -1.0,
                                -1.0,
                                source.x,
                                source.y,
                                target.x,
                                target.y,
                                30.0,
                            );
                        }
                    }
                    assert_eq!(
                        actual.map(f64::to_bits),
                        expected.map(f64::to_bits),
                        "shift={shift}, fixture={fixture}, final={final_route}"
                    );
                }
            }
        }
    }

    #[test]
    fn candidate_unbounded_coordinates_and_widths_match_original() {
        // The candidate host intentionally retains its general numeric helper.
        // Huge/invalid public-helper inputs must not change its old result just
        // because only the final-route host applies a finite-coordinate gate.
        for shift in [0.0, 1e20, -1e150] {
            let source = Point {
                x: shift - 100.0,
                y: shift,
            };
            let target = Point {
                x: shift + 100.0,
                y: shift,
            };
            let nodes = [
                shift,
                shift + 30.0,
                24.0,
                shift + 200.0,
                shift,
                100.0,
                shift,
                shift,
                1e200,
                shift,
                shift,
                f64::INFINITY,
                shift,
                shift,
                f64::NAN,
                f64::NAN,
                shift,
                24.0,
                shift,
                f64::INFINITY,
                24.0,
                f64::INFINITY,
                f64::INFINITY,
                24.0,
            ];
            for curve in [&[1.0, 1.0, 0.0, 0.5][..], &[0.0, 0.0][..]] {
                for clearance in [0.0, 30.0, f64::INFINITY, f64::NAN] {
                    let expected = reference(&nodes, curve, source, target, clearance, false);
                    let mut actual = [0.0; 3];
                    unsafe {
                        routing_node_shape(
                            nodes.as_ptr(),
                            curve.as_ptr(),
                            actual.as_mut_ptr(),
                            nodes.len() / 3,
                            -1.0,
                            -1.0,
                            source.x,
                            source.y,
                            target.x,
                            target.y,
                            clearance,
                        );
                    }
                    assert_eq!(
                        actual.map(f64::to_bits),
                        expected.map(f64::to_bits),
                        "shift={shift}, clearance={clearance}, curve={curve:?}"
                    );
                }
            }
        }
    }

    #[test]
    fn threshold_bands_and_adaptive_split_ties_keep_fallback_flags() {
        for shift in [0.0, 1e9, 1e12] {
            let source = Point {
                x: shift - 100.0,
                y: shift,
            };
            let target = Point {
                x: shift + 100.0,
                y: shift,
            };
            let mut nodes = Vec::new();
            for offset in [30.0 - 2e-7, 30.0 - 1e-8, 30.0, 30.0 + 1e-8, 30.0 + 2e-7] {
                for width in [24.0, 100.0] {
                    nodes.extend([shift, shift + offset, width]);
                    nodes.extend([shift + 200.0, shift + offset, width]);
                }
            }
            for curve in [&[1.0, 1.0, 0.0, 0.5][..], &[1.0, 1.0, 0.5, 0.5][..]] {
                let expected = reference(&nodes, curve, source, target, 30.0, true);
                let mut actual = [0.0; 3];
                unsafe {
                    routing_node_collisions(
                        nodes.as_ptr(),
                        curve.as_ptr(),
                        actual.as_mut_ptr(),
                        nodes.len() / 3,
                        -1.0,
                        -1.0,
                        source.x,
                        source.y,
                        target.x,
                        target.y,
                    );
                }
                assert_eq!(
                    actual.map(f64::to_bits),
                    expected.map(f64::to_bits),
                    "shift={shift}, curve={curve:?}"
                );
            }
        }
    }

    #[test]
    fn final_route_threshold_and_pruning_work_are_independent() {
        let nodes = [
            -100.0, 0.0, 24.0, 100.0, 0.0, 24.0, 0.0, 29.99, 24.0, 0.0, 30.0, 24.0, 0.0, 48.0,
            24.0, 0.0, 48.0000001, 24.0,
        ];
        let curve = [1.0, 1.0, 0.0, 0.5];
        let mut out = [0.0; 3];
        unsafe {
            routing_node_collisions(
                nodes.as_ptr(),
                curve.as_ptr(),
                out.as_mut_ptr(),
                6,
                0.0,
                1.0,
                -100.0,
                0.0,
                100.0,
                0.0,
            );
        }
        assert_eq!(out, [1.0, 3.0, 1.0]);
    }

    #[test]
    fn wide_capsules_and_empty_curves_preserve_counts() {
        let nodes = [-100.0, 0.0, 24.0, 100.0, 0.0, 24.0, 200.0, 0.0, 100.0];
        let straight = [1.0, 1.0, 0.0, 0.5];
        let empty = [0.0, 0.0];
        let mut out = [0.0; 3];
        unsafe {
            routing_node_collisions(
                nodes.as_ptr(),
                straight.as_ptr(),
                out.as_mut_ptr(),
                3,
                0.0,
                1.0,
                -100.0,
                0.0,
                100.0,
                0.0,
            );
        }
        assert_eq!(out, [1.0, 1.0, 0.0]);
        unsafe {
            routing_node_collisions(
                nodes.as_ptr(),
                empty.as_ptr(),
                out.as_mut_ptr(),
                3,
                0.0,
                1.0,
                -100.0,
                0.0,
                100.0,
                0.0,
            );
        }
        assert_eq!(out, [0.0, 1.0, 0.0]);
    }
}

#[cfg(test)]
mod loop_tests {
    use super::{hypot, routing_loop_obstacles};

    fn reference(nodes: &[f64], points: &[f64], clearance: f64, pill: bool) -> Vec<f64> {
        let mut output = vec![0.0; nodes.len()];
        for (index, node) in nodes.chunks_exact(3).enumerate() {
            let span = if pill { (node[2] - 24.0).max(0.0) } else { 0.0 };
            let mut distance = f64::INFINITY;
            for point in points.chunks_exact(2) {
                let dx = if pill {
                    ((point[0] - node[0]).abs() - span).max(0.0)
                } else {
                    node[0] - point[0]
                };
                distance = distance.min(hypot(dx, node[1] - point[1]));
            }
            output[index * 3] = (clearance - distance).max(0.0).powi(2);
            output[index * 3 + 1] = (points.len() / 2 + usize::from(!pill)) as f64;
            output[index * 3 + 2] = (distance < clearance) as u8 as f64;
        }
        output
    }

    fn run(nodes: &[f64], points: &[f64], clearance: f64, pill: bool) -> Vec<f64> {
        let mut output = vec![0.0; nodes.len()];
        unsafe {
            routing_loop_obstacles(
                nodes.as_ptr(),
                points.as_ptr(),
                output.as_mut_ptr(),
                nodes.len() / 3,
                points.len() / 2,
                clearance,
                f64::NEG_INFINITY,
                f64::NEG_INFINITY,
                f64::INFINITY,
                f64::INFINITY,
                u32::from(pill),
            );
        }
        output
    }

    #[test]
    fn bounded_rejection_preserves_scores_counts_and_every_sample_unit() {
        let mut state = 1847_u64;
        let mut random = || {
            state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
            (state >> 11) as f64 / (1_u64 << 53) as f64
        };
        for shift in [0.0, -1e9, 1e12] {
            for fixture in 0..40 {
                let nodes: Vec<f64> = (0..32)
                    .flat_map(|index| {
                        [
                            shift + random() * 500.0 - 250.0,
                            shift + random() * 500.0 - 250.0,
                            if index % 2 == 0 {
                                24.0
                            } else {
                                24.0 + random() * 100.0
                            },
                        ]
                    })
                    .collect();
                let points: Vec<f64> = (0..18)
                    .flat_map(|_| {
                        [
                            shift + random() * 140.0 - 70.0,
                            shift + random() * 140.0 - 70.0,
                        ]
                    })
                    .collect();
                for pill in [false, true] {
                    let clearance = if fixture % 2 == 0 { 30.0 } else { 42.0 };
                    let mut actual = run(&nodes, &points, clearance, pill);
                    let expected = reference(&nodes, &points, clearance, pill);
                    if actual[2] == -1.0 {
                        actual[2] = expected[2];
                    }
                    assert_eq!(
                        actual, expected,
                        "shift={shift}, fixture={fixture}, pill={pill}"
                    );
                }
            }
        }
        for points in [&[][..], &[1000.0, 1000.0][..]] {
            let nodes = [0.0, 0.0, 24.0];
            assert_eq!(
                run(&nodes, points, 30.0, true),
                reference(&nodes, points, 30.0, true)
            );
        }
    }

    #[test]
    fn strict_threshold_rounding_requests_the_js_batch_reference() {
        let points = [0.0, 0.0];
        for y in [0.0, 2.785979953862811] {
            let x = if y == 0.0 { 30.0 } else { 29.870358479547487 };
            let output = run(&[x, y, 24.0], &points, 30.0, true);
            assert_eq!(output[2], -1.0);
            assert_eq!(output[1], 1.0);
        }
        assert_eq!(run(&[29.99, 0.0, 24.0], &points, 30.0, true)[2], 1.0);
        assert_eq!(run(&[30.01, 0.0, 24.0], &points, 30.0, true)[2], 0.0);
    }
}
