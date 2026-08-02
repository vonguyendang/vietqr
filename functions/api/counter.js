export async function onRequest(context) {
  const { env } = context;
  const FAKE_START_COUNT = 15302;
  let count = FAKE_START_COUNT;

  try {
    // Nếu KV namespace chưa được bind, bỏ qua (để chạy dev không bị lỗi quá nhanh nếu chưa config)
    if (env.VIETQR_KV) {
      let currentCountStr = await env.VIETQR_KV.get("visit_count");
      
      if (currentCountStr) {
        count = parseInt(currentCountStr) + 1;
      } else {
        count = FAKE_START_COUNT + 1;
      }

      await env.VIETQR_KV.put("visit_count", count.toString());
    }
  } catch (error) {
    console.error("KV Error:", error);
    // Vẫn trả về số giả lập nếu lỗi
  }

  // Format số với dấu phẩy
  const formattedCount = new Intl.NumberFormat('en-US').format(count);

  return new Response(JSON.stringify({ 
    success: true, 
    count: count,
    formattedCount: formattedCount
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      // Chống cache API đếm
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
