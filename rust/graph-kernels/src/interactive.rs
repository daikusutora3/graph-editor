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

#[no_mangle]
pub unsafe extern "C" fn interactive_straight_reroutes(
    nodes_ptr: *const f64,
    half_heights_ptr: *const f64,
    edges_ptr: *const f64,
    output_ptr: *mut f64,
    node_count: usize,
    edge_count: usize,
) {
    let nodes = slice::from_raw_parts(nodes_ptr, node_count * 3);
    let half_heights = slice::from_raw_parts(half_heights_ptr, node_count);
    let edges = slice::from_raw_parts(edges_ptr, edge_count * 6);
    let output = slice::from_raw_parts_mut(output_ptr, edge_count);
    for (edge_index, edge) in edges.chunks_exact(6).enumerate() {
        output[edge_index] = 0.0;
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
        let error = point_segment_distance(control, source, target) / 2.0;
        if error > 0.25 {
            output[edge_index] = 2.0;
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
        for (node_index, node) in nodes.chunks_exact(3).enumerate() {
            let extra = (half_heights[node_index] - 24.0).max(0.0);
            let clearance = 60.0 + half_heights[node_index];
            if node[0] + node[2] + extra < x1
                || node[0] - node[2] - extra > x2
                || node[1] + extra < y1
                || node[1] - extra > y2
            {
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
            let tolerance = 1e-7_f64.max(f64::EPSILON * coordinate_scale * 32.0);
            if (distance - clearance).abs() <= tolerance || !distance.is_finite() {
                output[edge_index] = 2.0;
                break;
            }
            if distance < clearance {
                output[edge_index] = 1.0;
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::interactive_straight_reroutes;

    #[test]
    fn later_node_writes_the_current_edge_result() {
        let edges = [0.0, 0.0, 120.0, 0.0, 0.5, 1.0];
        for (y, expected) in [(83.0, 1.0), (84.0, 2.0), (85.0, 0.0)] {
            let nodes = [10000.0, 10000.0, 0.0, 60.0, y, 0.0];
            let mut result = [0.0];
            unsafe {
                interactive_straight_reroutes(
                    nodes.as_ptr(),
                    [24.0, 24.0].as_ptr(),
                    edges.as_ptr(),
                    result.as_mut_ptr(),
                    2,
                    1,
                );
            }
            assert_eq!(result, [expected]);
        }
    }

    #[test]
    fn high_node_index_does_not_address_the_shorter_edge_output() {
        let mut nodes = vec![10000.0; 128 * 3];
        let mut half_heights = vec![24.0; 128];
        let edges: Vec<f64> = (0..8)
            .flat_map(|index| {
                let x = index as f64 * 1000.0;
                [x, 0.0, x + 120.0, 0.0, 0.5, 1.0]
            })
            .collect();
        half_heights[127] = 36.0;
        for (y, expected) in [(95.0, 1.0), (96.0, 2.0), (97.0, 0.0)] {
            nodes[127 * 3..].copy_from_slice(&[60.0, y, 0.0]);
            let mut result = [0.0; 8];
            unsafe {
                interactive_straight_reroutes(
                    nodes.as_ptr(),
                    half_heights.as_ptr(),
                    edges.as_ptr(),
                    result.as_mut_ptr(),
                    128,
                    8,
                );
            }
            let mut expected_results = [0.0; 8];
            expected_results[0] = expected;
            assert_eq!(result, expected_results);
        }
    }

    #[test]
    fn measured_height_updates_strict_interactive_clearance() {
        let edges = [0.0, 0.0, 120.0, 0.0, 0.5, 1.0];
        for (y, expected) in [(95.0, 1.0), (96.0, 2.0), (97.0, 0.0)] {
            let mut result = [0.0];
            unsafe {
                interactive_straight_reroutes(
                    [60.0, y, 0.0].as_ptr(),
                    [36.0].as_ptr(),
                    edges.as_ptr(),
                    result.as_mut_ptr(),
                    1,
                    1,
                );
            }
            assert_eq!(result, [expected]);
        }
    }

    #[test]
    fn mixed_node_heights_affect_only_the_nearby_edge() {
        let nodes = [60.0, 90.0, 0.0, 1060.0, 90.0, 0.0];
        let edges = [
            0.0, 0.0, 120.0, 0.0, 0.5, 1.0, 1000.0, 0.0, 1120.0, 0.0, 0.5, 1.0,
        ];
        let mut result = [0.0; 2];
        unsafe {
            interactive_straight_reroutes(
                nodes.as_ptr(),
                [24.0, 36.0].as_ptr(),
                edges.as_ptr(),
                result.as_mut_ptr(),
                2,
                2,
            );
        }
        assert_eq!(result, [0.0, 1.0]);
    }

    #[test]
    fn strict_threshold_uses_js_and_distant_nodes_keep_the_route() {
        let edges = [0.0, 0.0, 120.0, 0.0, 0.5, 1.0];
        for (y, expected) in [(83.0, 1.0), (84.0, 2.0), (85.0, 0.0), (10000.0, 0.0)] {
            let nodes = [60.0, y, 0.0];
            let mut result = [0.0];
            unsafe {
                interactive_straight_reroutes(
                    nodes.as_ptr(),
                    vec![24.0; nodes.len() / 3].as_ptr(),
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
            interactive_straight_reroutes(
                nodes.as_ptr(),
                vec![24.0; nodes.len() / 3].as_ptr(),
                edges.as_ptr(),
                result.as_mut_ptr(),
                1,
                2,
            )
        };
        assert_eq!(result, [1.0, 0.0]);
    }
}
