use std::slice;

#[derive(Clone, Copy)]
struct Obstacle {
    start: f64,
    end: f64,
    negative: f64,
    positive: f64,
}

fn near_boundary(value: f64, boundary: f64) -> bool {
    (value - boundary).abs() <= 1e-12_f64.max(f64::EPSILON * value.abs().max(boundary.abs()) * 32.0)
}

fn pill_extent(
    half_width: f64,
    half_height: f64,
    dir_x: f64,
    dir_y: f64,
    direction_length: f64,
) -> Option<f64> {
    let span = (half_width - half_height).max(0.0);
    if span == 0.0 {
        return Some(half_height);
    }
    let ux = dir_x / direction_length;
    let uy = dir_y / direction_length;
    let mut low = half_height;
    let mut high = half_width;
    let squared_radius = half_height * half_height;
    let tolerance = 1e-10_f64
        .max(2.0 * half_height * 1e-12)
        .max(f64::EPSILON * squared_radius * 32.0);
    for _ in 0..24 {
        let t = (low + high) / 2.0;
        let px = (t * ux).abs();
        let py = t * uy;
        let outside_x = (px - span).max(0.0);
        let squared_distance = outside_x * outside_x + py * py;
        if (squared_distance - squared_radius).abs() <= tolerance {
            return None;
        }
        if squared_distance < squared_radius {
            low = t;
        } else {
            high = t;
        }
    }
    Some((low + high) / 2.0)
}

fn project(
    nodes: &[f64],
    half_heights: &[f64],
    source_index: f64,
    target_index: f64,
    sx: f64,
    sy: f64,
    length: f64,
    unit_x: f64,
    unit_y: f64,
    along_direction_length: f64,
    normal_direction_length: f64,
    base_clearance: f64,
) -> Option<(Vec<Obstacle>, bool)> {
    let normal_x = -unit_y;
    let normal_y = unit_x;
    let mut obstacles = Vec::new();
    let mut extents: Vec<(u64, u64, f64, f64)> = Vec::new();
    for (index, node) in nodes.chunks_exact(3).enumerate() {
        if index as f64 == source_index || index as f64 == target_index {
            continue;
        }
        let relative_x = node[0] - sx;
        let relative_y = node[1] - sy;
        let half_height = half_heights[index];
        let node_clearance = (base_clearance + half_height - 24.0).max(0.0);
        let (across_extra, along_extra) = if node[2] <= half_height {
            (0.0, 0.0)
        } else if let Some((_, _, across, along)) = extents.iter().find(|(width, height, _, _)| {
            *width == node[2].to_bits() && *height == half_height.to_bits()
        }) {
            (*across, *along)
        } else {
            let across = pill_extent(
                node[2],
                half_height,
                normal_x,
                normal_y,
                normal_direction_length,
            )? - half_height;
            let along = pill_extent(node[2], half_height, unit_x, unit_y, along_direction_length)?
                - half_height;
            if extents.len() < 16 {
                extents.push((node[2].to_bits(), half_height.to_bits(), across, along));
            }
            (across, along)
        };
        let clearance = node_clearance + across_extra;
        let raw_extent = (node_clearance + along_extra) / length;
        if near_boundary(raw_extent, 0.22) {
            return None;
        }
        let extent = raw_extent.min(0.22);
        let along_weight = (relative_x * unit_x + relative_y * unit_y) / length;
        let raw_start = along_weight - extent;
        let raw_end = along_weight + extent;
        if [raw_start, raw_end]
            .iter()
            .any(|value| near_boundary(*value, 0.08) || near_boundary(*value, 0.92))
        {
            return None;
        }
        let start = raw_start.max(0.08).min(0.92);
        let end = raw_end.max(0.08).min(0.92);
        if start >= end {
            continue;
        }
        let perpendicular = relative_x * normal_x + relative_y * normal_y;
        let distance = perpendicular.abs();
        let boundary = clearance * 1.8;
        if near_boundary(distance, boundary) {
            return None;
        }
        if distance >= boundary {
            continue;
        }
        obstacles.push(Obstacle {
            start,
            end,
            negative: perpendicular - clearance,
            positive: perpendicular + clearance,
        });
    }
    obstacles.sort_by(|a, b| a.start.partial_cmp(&b.start).unwrap());
    let mut clusters: Vec<Obstacle> = Vec::new();
    for obstacle in obstacles {
        if let Some(previous) = clusters.last_mut() {
            let boundary = previous.end + 0.06;
            if near_boundary(obstacle.start, boundary) {
                return None;
            }
            if obstacle.start <= boundary {
                previous.end = previous.end.max(obstacle.end);
                previous.positive = previous.positive.max(obstacle.positive);
                previous.negative = previous.negative.min(obstacle.negative);
                continue;
            }
        }
        clusters.push(obstacle);
    }
    if clusters.len() <= 2 {
        return Some((clusters, false));
    }
    let first = clusters[0];
    let last = *clusters.last().unwrap();
    let collapsed = Obstacle {
        start: first.start,
        end: last.end,
        positive: clusters
            .iter()
            .fold(f64::NEG_INFINITY, |maximum, obstacle| {
                maximum.max(obstacle.positive)
            }),
        negative: clusters.iter().fold(f64::INFINITY, |minimum, obstacle| {
            minimum.min(obstacle.negative)
        }),
    };
    Some((vec![collapsed], true))
}

#[no_mangle]
pub unsafe extern "C" fn routing_projected_obstacles(
    nodes_ptr: *const f64,
    half_heights_ptr: *const f64,
    output_ptr: *mut f64,
    node_count: usize,
    source_index: f64,
    target_index: f64,
    sx: f64,
    sy: f64,
    length: f64,
    unit_x: f64,
    unit_y: f64,
    along_direction_length: f64,
    normal_direction_length: f64,
    base_clearance: f64,
) {
    let nodes = slice::from_raw_parts(nodes_ptr, node_count * 3);
    let half_heights = slice::from_raw_parts(half_heights_ptr, node_count);
    let output = slice::from_raw_parts_mut(output_ptr, 10);
    output.fill(0.0);
    let Some((clusters, collapsed)) = project(
        nodes,
        half_heights,
        source_index,
        target_index,
        sx,
        sy,
        length,
        unit_x,
        unit_y,
        along_direction_length,
        normal_direction_length,
        base_clearance,
    ) else {
        output[0] = -1.0;
        return;
    };
    output[0] = clusters.len() as f64;
    output[1] = if collapsed { 1.0 } else { 0.0 };
    for (index, obstacle) in clusters.iter().enumerate() {
        output[2 + index * 4] = obstacle.start;
        output[3 + index * 4] = obstacle.end;
        output[4 + index * 4] = obstacle.negative;
        output[5 + index * 4] = obstacle.positive;
    }
}

#[cfg(test)]
mod tests {
    use super::{pill_extent, project};

    #[test]
    fn squared_capsule_ties_keep_the_wider_js_fallback() {
        let dir_x = 0.84_f64.sqrt();
        for delta in [-1e-15, 0.0, 1e-15] {
            assert!(pill_extent(96.0, 24.0, dir_x, 0.4 + delta, 1.0).is_none());
        }
    }

    #[test]
    fn circles_merge_in_stable_order_and_more_than_two_clusters_collapse() {
        let nodes = [200.0, 0.0, 24.0, 800.0, 10.0, 24.0, 1400.0, -10.0, 24.0];
        let (clusters, collapsed) = project(
            &nodes,
            &vec![24.0; nodes.len() / 3],
            -1.0,
            -1.0,
            0.0,
            0.0,
            1600.0,
            1.0,
            0.0,
            1.0,
            1.0,
            30.0,
        )
        .unwrap();
        assert!(collapsed);
        assert_eq!(clusters.len(), 1);
        assert_eq!(clusters[0].start, 0.10625);
        assert_eq!(clusters[0].end, 0.89375);
        assert_eq!(clusters[0].negative, -40.0);
        assert_eq!(clusters[0].positive, 40.0);
    }

    #[test]
    fn perpendicular_strict_ties_request_the_reference() {
        let nodes = [500.0, 54.0, 24.0];
        assert!(project(
            &nodes,
            &vec![24.0; nodes.len() / 3],
            -1.0,
            -1.0,
            0.0,
            0.0,
            1000.0,
            1.0,
            0.0,
            1.0,
            1.0,
            30.0
        )
        .is_none());
    }

    #[test]
    fn measured_circles_expand_projection_and_keep_strict_boundaries() {
        for (y, expected_count) in [(75.6 - 1e-8, 1), (75.6 + 1e-8, 0)] {
            let (clusters, _) = project(
                &[500.0, y, 36.0],
                &[36.0],
                -1.0,
                -1.0,
                0.0,
                0.0,
                1000.0,
                1.0,
                0.0,
                1.0,
                1.0,
                30.0,
            )
            .unwrap();
            assert_eq!(clusters.len(), expected_count);
        }
        assert!(project(
            &[500.0, 42.0 * 1.8, 36.0],
            &[36.0],
            -1.0,
            -1.0,
            0.0,
            0.0,
            1000.0,
            1.0,
            0.0,
            1.0,
            1.0,
            30.0,
        )
        .is_none());
        let mut output = [0.0; 10];
        unsafe {
            super::routing_projected_obstacles(
                [500.0, 0.0, 36.0].as_ptr(),
                [36.0].as_ptr(),
                output.as_mut_ptr(),
                1,
                -1.0,
                -1.0,
                0.0,
                0.0,
                1000.0,
                1.0,
                0.0,
                1.0,
                1.0,
                30.0,
            );
        }
        assert_eq!(&output[..6], &[1.0, 0.0, 0.458, 0.542, -42.0, 42.0]);
    }

    #[test]
    fn equal_widths_with_mixed_heights_use_distinct_cached_extents() {
        let nodes = [1000.0, 0.0, 96.0, 4000.0, 0.0, 96.0];
        let heights = [24.0, 36.0];
        let (actual, collapsed) = project(
            &nodes, &heights, -1.0, -1.0, 0.0, 0.0, 5000.0, 1.0, 0.0, 1.0, 1.0, 30.0,
        )
        .unwrap();
        assert!(!collapsed);
        assert_eq!(actual.len(), 2);
        for index in 0..2 {
            let (single, _) = project(
                &nodes[index * 3..index * 3 + 3],
                &heights[index..index + 1],
                -1.0,
                -1.0,
                0.0,
                0.0,
                5000.0,
                1.0,
                0.0,
                1.0,
                1.0,
                30.0,
            )
            .unwrap();
            assert_eq!(actual[index].start.to_bits(), single[0].start.to_bits());
            assert_eq!(actual[index].end.to_bits(), single[0].end.to_bits());
            assert_eq!(
                actual[index].negative.to_bits(),
                single[0].negative.to_bits()
            );
            assert_eq!(
                actual[index].positive.to_bits(),
                single[0].positive.to_bits()
            );
        }
        assert!(pill_extent(144.0, 36.0, 0.84_f64.sqrt(), 0.4, 1.0).is_none());
    }

    #[test]
    fn capped_width_cache_matches_individual_uncached_searches() {
        let widths: Vec<f64> = (0..40).map(|index| 32.0 + index as f64 * 7.25).collect();
        let repeated = widths
            .iter()
            .copied()
            .chain(widths[..8].iter().copied())
            .chain(widths[24..].iter().copied());
        let mut nodes = Vec::new();
        let mut expected: Option<super::Obstacle> = None;
        for width in repeated {
            let single = [800.0, 0.0, width];
            nodes.extend(single);
            let (result, _) = project(
                &single,
                &vec![24.0; single.len() / 3],
                -1.0,
                -1.0,
                0.0,
                0.0,
                1600.0,
                1.0,
                0.0,
                1.0,
                1.0,
                30.0,
            )
            .unwrap();
            let obstacle = result[0];
            if let Some(previous) = expected.as_mut() {
                previous.start = previous.start.min(obstacle.start);
                previous.end = previous.end.max(obstacle.end);
                previous.negative = previous.negative.min(obstacle.negative);
                previous.positive = previous.positive.max(obstacle.positive);
            } else {
                expected = Some(obstacle);
            }
        }
        let (actual, collapsed) = project(
            &nodes,
            &vec![24.0; nodes.len() / 3],
            -1.0,
            -1.0,
            0.0,
            0.0,
            1600.0,
            1.0,
            0.0,
            1.0,
            1.0,
            30.0,
        )
        .unwrap();
        let expected = expected.unwrap();
        assert!(!collapsed);
        assert_eq!(actual.len(), 1);
        assert_eq!(actual[0].start, expected.start);
        assert_eq!(actual[0].end, expected.end);
        assert_eq!(actual[0].negative, expected.negative);
        assert_eq!(actual[0].positive, expected.positive);
    }
}
