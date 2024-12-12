try {
  const response = await fetch(serverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  console.log('[DEBUG] 服务器响应状态:', response.status);
  const responseData = await response.json();
  console.log('[DEBUG] 服务器响应数据:', responseData);
  
  if (!responseData.imageUrl) {
    throw new Error('服务器返回的数据中没有图片URL');
  }
  
  // ... 后续处理 ...
  
} catch (error) {
  console.error('[ERROR] 请求失败:', error);
  // ... 错误处理 ...
}