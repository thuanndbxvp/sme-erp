/**
 * Mock sanitize-html cho Jest.
 *
 * sanitize-html dùng htmlparser2 (ESM) gây lỗi "Cannot use import statement
 * outside a module" khi Jest load. Mock này trả về input nguyên vẹn (pass-through)
 * — đủ cho unit test validation (test logic Zod, không test bản thân sanitize-html).
 *
 * Trong production, Next.js build xử lý ESM bình thường — mock chỉ dùng cho Jest.
 */
module.exports = function sanitizeHtml(input) {
  return input;
};
module.exports.default = module.exports;