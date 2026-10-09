//! Numeric layout kernels. Graph IDs, label measurement and output normalization
//! stay in TypeScript; a complete relaxation crosses the Wasm boundary once.

use crate::numeric::hypot;
use std::slice;

#[no_mangle]
pub unsafe extern "C" fn force_layout(
    seeds_ptr: *const f64,
    edges_ptr: *const f64,
    output_ptr: *mut f64,
    node_count: u32,
    edge_count: u32,
    ideal: f64,
) {
    let count = node_count as usize;
    let seeds = slice::from_raw_parts(seeds_ptr, count * 3);
    let edges = slice::from_raw_parts(edges_ptr, edge_count as usize * 2);
    let positions = slice::from_raw_parts_mut(output_ptr, count * 2);
    for index in 0..count {
        positions[index * 2] = seeds[index * 3];
        positions[index * 2 + 1] = seeds[index * 3 + 1];
    }
    let mut displacement = vec![0.0; count * 2];
    let mut temperature = ideal * 0.8;
    for _ in 0..180 {
        displacement.fill(0.0);
        for first in 0..count {
            for second in first + 1..count {
                let mut dx = positions[first * 2] - positions[second * 2];
                let mut dy = positions[first * 2 + 1] - positions[second * 2 + 1];
                let mut distance = hypot(dx, dy);
                if distance < 0.01 {
                    dx = seeds[first * 3 + 2];
                    dy = seeds[second * 3 + 2];
                    distance = hypot(dx, dy);
                    if distance == 0.0 {
                        distance = 1.0;
                    }
                }
                let force = (ideal * ideal) / distance;
                let offset_x = (dx / distance) * force;
                let offset_y = (dy / distance) * force;
                displacement[first * 2] += offset_x;
                displacement[first * 2 + 1] += offset_y;
                displacement[second * 2] -= offset_x;
                displacement[second * 2 + 1] -= offset_y;
            }
        }
        for edge in edges.chunks_exact(2) {
            let source = edge[0] as usize;
            let target = edge[1] as usize;
            let dx = positions[source * 2] - positions[target * 2];
            let dy = positions[source * 2 + 1] - positions[target * 2 + 1];
            let distance = hypot(dx, dy).max(0.01);
            let force = (distance * distance) / ideal;
            let offset_x = (dx / distance) * force;
            let offset_y = (dy / distance) * force;
            displacement[source * 2] -= offset_x;
            displacement[source * 2 + 1] -= offset_y;
            displacement[target * 2] += offset_x;
            displacement[target * 2 + 1] += offset_y;
        }
        for index in 0..count {
            let dx = displacement[index * 2];
            let dy = displacement[index * 2 + 1];
            let length = hypot(dx, dy).max(0.01);
            let step = length.min(temperature);
            positions[index * 2] += (dx / length) * step;
            positions[index * 2 + 1] += (dy / length) * step;
        }
        temperature *= 0.965;
    }
}

#[no_mangle]
pub unsafe extern "C" fn node_clearance(
    nodes_ptr: *const f64,
    output_ptr: *mut f64,
    node_count: u32,
    required: f64,
    max_required_squared: f64,
) {
    let nodes = slice::from_raw_parts(nodes_ptr, node_count as usize * 3);
    let mut scale = 1.0_f64;
    for first in 0..node_count as usize {
        for second in first + 1..node_count as usize {
            let dx = nodes[second * 3] - nodes[first * 3];
            let dy = nodes[second * 3 + 1] - nodes[first * 3 + 1];
            if dy.abs() * scale >= required {
                continue;
            }
            let distance_squared = dx * dx + dy * dy;
            if distance_squared == 0.0 || distance_squared > max_required_squared {
                continue;
            }
            let span = nodes[first * 3 + 2] + nodes[second * 3 + 2];
            let distance_at = |factor: f64| (dx.abs() * factor - span).max(0.0).hypot(dy * factor);
            if distance_at(scale) >= required {
                continue;
            }
            let mut low = scale;
            let mut high = scale.max((span + required) / distance_squared.sqrt());
            for _ in 0..32 {
                let middle = (low + high) / 2.0;
                if distance_at(middle) < required {
                    low = middle;
                } else {
                    high = middle;
                }
            }
            scale = high;
        }
    }
    *output_ptr = scale;
}
