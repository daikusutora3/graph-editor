//! Batched numeric kernels. The browser supplies measured geometry and retains
//! graph IDs, editing history and rendering. ABI buffers use f64 allocations;
//! the import scanner reads packed text bytes from its input allocation.

pub mod import;
pub mod interactive;
pub mod layouts;
pub mod numeric;
pub mod obstacles;
pub mod overlaps;
pub mod routing;

#[no_mangle]
pub extern "C" fn kernel_abi_version() -> u32 {
    1
}

#[no_mangle]
pub extern "C" fn alloc_f64(len: usize) -> *mut f64 {
    Box::into_raw(vec![0.0; len].into_boxed_slice()) as *mut f64
}

/// # Safety
/// `ptr` must be a live allocation from alloc_f64, with the original length.
#[no_mangle]
pub unsafe extern "C" fn free_f64(ptr: *mut f64, len: usize) {
    drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
}
