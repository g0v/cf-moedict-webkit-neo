export default {
  fetch(request) {
    console.log('🔍 [Index] 開始處理請求:', request.url);
    const url = new URL(request.url);
    console.log(url.pathname);

    if (url.pathname.startsWith("/api/")) {
      console.log('🔍 [Index] 處理 API 請求:', url.pathname);
      return Response.json({
        name: "Cloudflare",
      });
    }
		return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
