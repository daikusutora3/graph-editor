//! Scan the normalized ASCII safe-integer subset of adjacency matrices.
//! Unsupported Number syntax is rejected for the host's existing JS fallback.

use std::slice;

const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;
const HEADER_LENGTH: usize = 8;

fn separator(byte: u8) -> bool {
    matches!(byte, b' ' | b'\t' | b'\r' | 0x0b | 0x0c | b',')
}

fn next_integer(row: &[u8], index: &mut usize) -> Option<f64> {
    while *index < row.len() && separator(row[*index]) {
        *index += 1;
    }
    if *index == row.len() {
        return None;
    }
    let negative = row[*index] == b'-';
    if matches!(row[*index], b'+' | b'-') {
        *index += 1;
    }
    let start = *index;
    let mut value = 0u64;
    while *index < row.len() && row[*index].is_ascii_digit() {
        value = value
            .checked_mul(10)?
            .checked_add((row[*index] - b'0') as u64)?;
        if value > MAX_SAFE_INTEGER {
            return None;
        }
        *index += 1;
    }
    if start == *index || (*index < row.len() && !separator(row[*index])) {
        return None;
    }
    Some(if negative {
        -(value as f64)
    } else {
        value as f64
    })
}

fn scan_matrix(data: &[u8], output: &mut [f64], size: usize, capacity: usize) -> bool {
    if size == 0 || size > 1000 || output.len() < HEADER_LENGTH + capacity * 3 {
        return false;
    }
    let mut previous = vec![0.0; size * size];
    let mut is_symmetric = true;
    let mut has_zero = false;
    let mut has_weighted = false;
    let mut directed_count = 0usize;
    let mut undirected_count = 0usize;
    let mut rows = data.split(|byte| *byte == b'\n');
    for source in 0..size {
        let Some(row) = rows.next() else { return false };
        let mut index = 0usize;
        for target in 0..size {
            let Some(value) = next_integer(row, &mut index) else {
                return false;
            };
            previous[source * size + target] = value;
            if target < source && value != previous[target * size + source] {
                is_symmetric = false;
            }
            if value == 0.0 {
                has_zero = true;
            } else {
                if directed_count < capacity {
                    let offset = HEADER_LENGTH + directed_count * 3;
                    output[offset] = source as f64;
                    output[offset + 1] = target as f64;
                    output[offset + 2] = value;
                }
                directed_count += 1;
                if target >= source {
                    undirected_count += 1;
                }
                has_weighted |= value != 1.0;
            }
        }
        while index < row.len() && separator(row[index]) {
            index += 1;
        }
        if index != row.len() {
            return false;
        }
    }
    if rows.next().is_some() {
        return false;
    }
    output[0] = 1.0;
    output[1] = if has_weighted { 0.0 } else { 1.0 };
    output[2] = if is_symmetric { 1.0 } else { 0.0 };
    output[3] = if has_zero { 1.0 } else { 0.0 };
    output[4] = if has_weighted { 1.0 } else { 0.0 };
    output[5] = size as f64;
    output[6] = directed_count as f64;
    output[7] = undirected_count as f64;
    true
}

/// # Safety
/// `input` points to `byte_length` bytes in a live alloc_f64 allocation;
/// `output` points to HEADER_LENGTH + capacity * 3 live f64 entries.
#[no_mangle]
pub unsafe extern "C" fn import_integer_matrix(
    input: *const f64,
    output: *mut f64,
    byte_length: usize,
    size: usize,
    capacity: usize,
) {
    let data = slice::from_raw_parts(input.cast::<u8>(), byte_length);
    let result = slice::from_raw_parts_mut(output, HEADER_LENGTH + capacity * 3);
    result[0] = 0.0;
    scan_matrix(data, result, size, capacity);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn integers_and_symmetry_match_number_values() {
        let mut result = vec![0.0; HEADER_LENGTH + 9 * 3];
        assert!(scan_matrix(
            b"-0,+001,0\n1\t0\t-2\n0 -02 0",
            &mut result,
            3,
            9
        ));
        assert_eq!(
            &result[..HEADER_LENGTH],
            &[1.0, 0.0, 1.0, 1.0, 1.0, 3.0, 4.0, 2.0]
        );
        assert_eq!(
            &result[HEADER_LENGTH..HEADER_LENGTH + 12],
            &[0.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0, 2.0, -2.0, 2.0, 1.0, -2.0]
        );
    }

    #[test]
    fn unsupported_tokens_and_dimensions_fall_back() {
        for input in [
            "1.0",
            "1e0",
            "0x1",
            ".5",
            "NaN",
            "Infinity",
            "9007199254740992",
            "1 0",
            "1\n0",
            "\u{a0}1",
            "--1",
            "+",
        ] {
            let mut result = vec![0.0; HEADER_LENGTH + 3];
            assert!(!scan_matrix(input.as_bytes(), &mut result, 1, 1), "{input}");
            assert_eq!(result[0], 0.0);
        }
        let mut result = vec![0.0; HEADER_LENGTH + 3];
        assert!(scan_matrix(b"9007199254740991", &mut result, 1, 1));
        assert_eq!(result[HEADER_LENGTH + 2], MAX_SAFE_INTEGER as f64);
    }

    #[test]
    fn edge_storage_cap_does_not_change_counts() {
        let mut result = vec![0.0; HEADER_LENGTH + 3];
        assert!(scan_matrix(b"1 1\n1 1", &mut result, 2, 1));
        assert_eq!(result[6], 4.0);
        assert_eq!(result[7], 3.0);
        assert_eq!(&result[HEADER_LENGTH..], &[0.0, 0.0, 1.0]);
    }
}
