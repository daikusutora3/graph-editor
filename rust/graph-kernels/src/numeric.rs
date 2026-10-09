/// Canonical two-dimensional norm shared with compute/numeric.ts. No host
/// imports or software libm hypot calls in the hot pairwise loops.
pub fn hypot(x: f64, y: f64) -> f64 {
    let ax = x.abs();
    let ay = y.abs();
    if ax == f64::INFINITY || ay == f64::INFINITY {
        return f64::INFINITY;
    }
    if ax.is_nan() || ay.is_nan() {
        return f64::NAN;
    }
    let scale = ax.max(ay);
    if scale == 0.0 {
        return 0.0;
    }
    let sx = ax / scale;
    let sy = ay / scale;
    scale * (sx * sx + sy * sy).sqrt()
}
