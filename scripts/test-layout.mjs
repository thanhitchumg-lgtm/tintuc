// Kiểm tra thuật toán xếp bài lên trang chủ.
import assert from 'node:assert/strict';
import { assignSlots } from '../src/shared/home-layout.mjs';

const mk = (id, minutesAgo, featuredSlot = null, updatedAt = '') => ({
  id, featuredSlot, updatedAt,
  publishedAt: new Date(Date.UTC(2026, 10, 10, 12) - minutesAgo * 60000).toISOString(),
});

// 1) Không ai chọn vị trí: bài mới nhất lên đầu, sau đó theo thời gian
let r = assignSlots([mk('c', 30), mk('a', 10), mk('b', 20)], 3);
assert.deepEqual(r.slots.map((x) => x.id), ['a', 'b', 'c']);
assert.equal(r.rest.length, 0);

// 2) Có bài chọn vị trí 1 (dù cũ): chiếm vị trí 1, các vị trí còn lại xếp theo thời gian
r = assignSlots([mk('new', 1), mk('old', 500, 1), mk('mid', 50)], 3);
assert.deepEqual(r.slots.map((x) => x.id), ['old', 'new', 'mid']);

// 3) Chọn vị trí 3: bài đó ở vị trí 3, bài mới nhất vẫn đứng đầu
r = assignSlots([mk('a', 1), mk('b', 2), mk('c', 3), mk('pin', 900, 3)], 3);
assert.deepEqual(r.slots.map((x) => x.id), ['a', 'b', 'pin']);
assert.deepEqual(r.rest.map((x) => x.id), ['c']);

// 4) Hai bài cùng chọn vị trí 1: bài cập nhật sau thắng, bài kia về xếp theo thời gian
r = assignSlots([mk('x', 5, 1, '2026-11-10T01:00:00Z'), mk('y', 9, 1, '2026-11-10T02:00:00Z'), mk('z', 7)], 3);
assert.equal(r.slots[0].id, 'y');
assert.deepEqual(r.slots.map((s) => s.id), ['y', 'x', 'z']);

// 5) Ít bài hơn số vị trí: vị trí trống là null
r = assignSlots([mk('only', 1)], 4);
assert.deepEqual(r.slots.map((x) => x && x.id), ['only', null, null, null]);

// 6) Danh sách rỗng
r = assignSlots([], 3);
assert.deepEqual(r.slots, [null, null, null]);

console.log('Layout OK');
