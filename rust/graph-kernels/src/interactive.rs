//! Straight-route obstacle selection during dragging. IDs and scheduling stay
//! in TypeScript; each call owns only the supplied batch and releases no memory.

use crate::numeric::hypot;
use std::slice;

#[derive(Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
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

fn segment_distance(a: Point, b: Point, c: Point, d: Point) -> f64 {
    if a.y != b.y {
        let t = (c.y - a.y) / (b.y - a.y);
        let x = a.x + t * (b.x - a.x);
        if (0.0..=1.0).contains(&t) && x >= c.x && x <= d.x {
            return 0.0;
        }
    }
    point_segment_distance(a, c, d)
        .min(point_segment_distance(b, c, d))
        .min(point_segment_distance(c, a, b))
        .min(point_segment_distance(d, a, b))
}

/// nodes = [x,y,capsule_span]*N; edges = [sx,sy,tx,ty,weight,has_control]*E.
/// output per edge: 0 = keep, 1 = reroute, 2 = decide with the JS reference.
/// # Safety
/// Buffers must be live allocations sized for the supplied counts. TypeScript
/// admits only finite, bounded coordinates and straight, single-control curves.
#[no_mangle]
pub unsafe extern "C" fn interactive_straight_reroutes(
    nodes_ptr: *const f64,
    edges_ptr: *const f64,
    output_ptr: *mut f64,
    node_count: usize,
    edge_count: usize,
) {
    let nodes = slice::from_raw_parts(nodes_ptr, node_count * 3);
    let edges = slice::from_raw_parts(edges_ptr, edge_count * 6);
    let output = slice::from_raw_parts_mut(output_ptr, edge_count);
    for (index, edge) in edges.chunks_exact(6).enumerate() {
        output[index] = 0.0;
        // A curve without controls has no subdivision pieces in the JS solver.
        if edge[5] == 0.0 {
            continue;
        }
        let source = Point {
            x: edge[0],
            y: edge[1],
        };
        let target = Point {
            x: edge[2],
            y: edge[3],
        };
        let control = Point {
            x: source.x + (target.x - source.x) * edge[4],
            y: source.y + (target.y - source.y) * edge[4],
        };
        // Retain the JS adaptive solver's error deduction even for a straight
        // control: translated floating-point coordinates need not be collinear.
        let error = point_segment_distance(control, source, target) / 2.0;
        if error > 0.25 {
            output[index] = 2.0;
            continue;
        }
        let scale = 1.0_f64
            .max(source.x.abs())
            .max(source.y.abs())
            .max(target.x.abs())
            .max(target.y.abs());
        let margin = 85.0 + f64::EPSILON * scale * 8.0;
        let x1 = source.x.min(target.x) - margin;
        let x2 = source.x.max(target.x) + margin;
        let y1 = source.y.min(target.y) - margin;
        let y2 = source.y.max(target.y) + margin;
        for node in nodes.chunks_exact(3) {
            if node[0] + node[2] < x1 || node[0] - node[2] > x2 || node[1] < y1 || node[1] > y2 {
                continue;
            }
            let left = Point {
                x: node[0] - node[2],
                y: node[1],
            };
            let right = Point {
                x: node[0] + node[2],
                y: node[1],
            };
            let distance = segment_distance(source, target, left, right) - error;
            let coordinate_scale = scale.max(node[0].abs()).max(node[1].abs()).max(node[2]);
            // The hosts' hypot implementations can differ by rounding. Recheck
            // the original JS solver when that could change the strict 84px tie.
            let tolerance = 1e-7_f64.max(f64::EPSILON * coordinate_scale * 32.0);
            if (distance - 84.0).abs() <= tolerance || !distance.is_finite() {
                output[index] = 2.0;
                break;
            }
            if distance < 84.0 {
                output[index] = 1.0;
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::interactive_straight_reroutes;

    #[test]
    fn strict_threshold_uses_js_and_distant_nodes_keep_the_route() {
        let edges = [0.0, 0.0, 120.0, 0.0, 0.5, 1.0];
        for (y, expected) in [(83.0, 1.0), (84.0, 2.0), (85.0, 0.0), (10000.0, 0.0)] {
            let nodes = [60.0, y, 0.0];
            let mut result = [0.0];
            unsafe {
                interactive_straight_reroutes(
                    nodes.as_ptr(),
                    edges.as_ptr(),
                    result.as_mut_ptr(),
                    1,
                    1,
                )
            };
            assert_eq!(result[0], expected);
        }
    }

    #[test]
    fn long_capsule_and_empty_curve_match_the_reference_shape() {
        let nodes = [300.0, 30.0, 200.0];
        let edges = [
            0.0, 0.0, 120.0, 0.0, 0.5, 1.0, 0.0, 0.0, 120.0, 0.0, 0.5, 0.0,
        ];
        let mut result = [0.0; 2];
        unsafe {
            interactive_straight_reroutes(nodes.as_ptr(), edges.as_ptr(), result.as_mut_ptr(), 1, 2)
        };
        assert_eq!(result, [1.0, 0.0]);
    }
}
