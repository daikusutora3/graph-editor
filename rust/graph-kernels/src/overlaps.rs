//! Stadium overlap relaxation. Node ordering and label spans are prepared in
//! TypeScript so this kernel shares the editor's geometry and stable ordering.

const REQUIRED: f64 = 60.0;
const EPSILON: f64 = 0.00001;
const GRID: f64 = 24.0;

#[derive(Clone, Copy)]
struct Node {
    x: f64,
    y: f64,
    span: f64,
}

fn gap_x(a: Node, b: Node) -> f64 {
    ((b.x - a.x).abs() - a.span - b.span).max(0.0)
}

fn count_pairs(nodes: &[Node], limit: usize) -> usize {
    let mut order: Vec<usize> = (0..nodes.len()).collect();
    // Stable sorting matches the JavaScript sweep, including equal heights.
    order.sort_by(|&a, &b| nodes[a].y.total_cmp(&nodes[b].y));
    let mut remaining = 0;
    for i in 0..order.len() {
        let a = nodes[order[i]];
        for &index in &order[i + 1..] {
            let b = nodes[index];
            let dy = b.y - a.y;
            if dy >= REQUIRED {
                break;
            }
            let gap = if order[i] < index {
                gap_x(a, b)
            } else {
                gap_x(b, a)
            };
            if gap >= REQUIRED || gap.hypot(dy) >= REQUIRED - EPSILON {
                continue;
            }
            remaining += 1;
            if remaining >= limit {
                return remaining;
            }
        }
    }
    remaining
}

// JavaScript Math.sign preserves zero; f64::signum would turn it into +/-1.
fn js_sign(value: f64) -> f64 {
    if value == 0.0 {
        value
    } else {
        value.signum()
    }
}

// JavaScript rounds halfway values toward +infinity, including negative ones.
fn js_round(value: f64) -> f64 {
    if !value.is_finite() || value == 0.0 || value.abs() >= 4503599627370496.0 {
        return value;
    }
    if (-0.5..0.0).contains(&value) || value == -0.5 {
        return -0.0;
    }
    let lower = value.floor();
    lower + if value - lower >= 0.5 { 1.0 } else { 0.0 }
}

fn relax(nodes: &mut [Node], snap: bool, changed: &mut bool) -> usize {
    let mut remaining = 0;
    for i in 0..nodes.len() {
        for j in i + 1..nodes.len() {
            let a = nodes[i];
            let b = nodes[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let gap = gap_x(a, b);
            if gap >= REQUIRED || dy.abs() >= REQUIRED {
                continue;
            }
            let distance = gap.hypot(dy);
            if distance >= REQUIRED - EPSILON {
                continue;
            }
            remaining += 1;
            let ux = if distance > EPSILON {
                js_sign(dx) * gap / distance
            } else {
                0.0
            };
            let uy = if distance > EPSILON {
                dy / distance
            } else if (i + j) % 2 != 0 {
                1.0
            } else {
                -1.0
            };
            let push = (REQUIRED - distance + 0.001) / 2.0;
            let mut mx = ux * push;
            let mut my = uy * push;
            if snap {
                mx = js_sign(mx) * (mx.abs() / GRID).ceil() * GRID;
                my = js_sign(my) * (my.abs() / GRID).ceil() * GRID;
            }
            nodes[i].x -= mx;
            nodes[i].y -= my;
            nodes[j].x += mx;
            nodes[j].y += my;
            if snap {
                for index in [i, j] {
                    nodes[index].x = js_round(nodes[index].x / GRID) * GRID;
                    nodes[index].y = js_round(nodes[index].y / GRID) * GRID;
                }
            }
            *changed = true;
        }
    }
    remaining
}

fn resolve(nodes: &mut [Node], snap: bool) -> (usize, bool) {
    if count_pairs(nodes, 1) == 0 {
        return (0, false);
    }
    let mut changed = false;
    for _ in 0..128 {
        if relax(nodes, snap, &mut changed) == 0 {
            break;
        }
    }
    if count_pairs(nodes, usize::MAX) > 0 {
        for j in 1..nodes.len() {
            for _ in 0..nodes.len() {
                let mut moved = false;
                for i in 0..j {
                    let a = nodes[i];
                    let gap = gap_x(a, nodes[j]);
                    if gap.hypot(nodes[j].y - a.y) >= REQUIRED - EPSILON {
                        continue;
                    }
                    nodes[j].y = a.y + (REQUIRED * REQUIRED - gap * gap).sqrt() + 0.001;
                    if snap {
                        nodes[j].y = (nodes[j].y / GRID).ceil() * GRID;
                    }
                    moved = true;
                    changed = true;
                }
                if !moved {
                    break;
                }
            }
        }
    }
    (count_pairs(nodes, usize::MAX), changed)
}

/// Input consists of `node_count` x/y/span triples. Output consists of x/y
/// pairs followed by the remaining collision count and a 0/1 changed flag.
///
/// # Safety
/// Buffers must be separate, valid, and large enough for these lengths.
#[no_mangle]
pub unsafe extern "C" fn resolve_overlaps(
    nodes_ptr: *const f64,
    output_ptr: *mut f64,
    node_count: u32,
    snap: u32,
) {
    let count = node_count as usize;
    let input = std::slice::from_raw_parts(nodes_ptr, count * 3);
    let output = std::slice::from_raw_parts_mut(output_ptr, count * 2 + 2);
    let mut nodes: Vec<Node> = input
        .chunks_exact(3)
        .map(|point| Node {
            x: point[0],
            y: point[1],
            span: point[2],
        })
        .collect();
    let (remaining, changed) = resolve(&mut nodes, snap != 0);
    for (i, node) in nodes.iter().enumerate() {
        output[i * 2] = node.x;
        output[i * 2 + 1] = node.y;
    }
    output[count * 2] = remaining as f64;
    output[count * 2 + 1] = if changed { 1.0 } else { 0.0 };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grid_rounding_matches_javascript_negative_ties_and_zero() {
        assert_eq!(js_round(-1.5), -1.0);
        assert_eq!(js_round(-0.5), 0.0);
        assert!(js_round(-0.5).is_sign_negative());
        assert_eq!(js_round(0.5), 1.0);
        assert_eq!(js_sign(0.0), 0.0);
    }

    #[test]
    fn separating_coincident_capsules_keeps_grid_and_clearance() {
        for snap in [false, true] {
            let mut nodes = vec![
                Node {
                    x: -12.0,
                    y: -12.0,
                    span: 40.0
                };
                12
            ];
            let (remaining, changed) = resolve(&mut nodes, snap);
            assert_eq!(remaining, 0);
            assert!(changed);
            if snap {
                assert!(nodes
                    .iter()
                    .all(|node| node.x % GRID == 0.0 && node.y % GRID == 0.0));
            }
            let positions: Vec<_> = nodes.iter().map(|node| (node.x, node.y)).collect();
            assert_eq!(resolve(&mut nodes, snap), (0, false));
            assert_eq!(
                nodes
                    .iter()
                    .map(|node| (node.x, node.y))
                    .collect::<Vec<_>>(),
                positions
            );
        }
    }
}
