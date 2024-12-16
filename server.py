from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont
import os
import time
import hashlib
from io import BytesIO
import traceback
from card_generator import CardGenerator
import base64  # 添加base64模块导入

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # 确保这行配置正确

# 配置v
SAVE_DIR = "generated_cards"
if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR)

# 字体设置
font_path = os.path.join(os.path.dirname(__file__), 'fonts', 'STZHONGS.TTF')
if not os.path.exists(font_path):
    print("警告：找不到字体文件，将使用默认字体")
    font_path = None

# 初始化卡片生成器
card_generator = CardGenerator()

@app.route('/')
def index():
    """根路由处理"""
    return jsonify({
        "message": "服务器正在运行",
        "endpoints": {
            "status": "/status",
            "generate": "/generate"
        }
    })

@app.route('/status')
def status():
    """检查服务器状态"""
    return jsonify({
        "status": "ok",
        "timestamp": time.time()
    })

@app.route('/generate', methods=['POST'])
def generate_card():
    """生成分享卡片"""
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        url = data.get('url', '').strip()

        # 参数验证
        if not text:
            return jsonify({"error": "文本内容不能为空"}), 400
            
        # 使用 CardGenerator 生成卡片
        card = card_generator.generate_card(text, url)
        
        # 将图片转换为base64
        buffered = BytesIO()
        card.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return jsonify({
            "imageData": img_str,
            "status": "success"
        })

    except Exception as e:
        print(f"[ERROR] 生成图片失败: {str(e)}")
        print(f"[ERROR] 详细错误: {traceback.format_exc()}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route('/images/<filename>')
def serve_image(filename):
    """提供生成的图片"""
    try:
        return send_file(os.path.join(SAVE_DIR, filename))
    except:
        return jsonify({"error": "图片不存在"}), 404

# 定期清理旧图片
def cleanup_old_images():
    """清理24小时前的图片"""
    current_time = time.time()
    for filename in os.listdir(SAVE_DIR):
        filepath = os.path.join(SAVE_DIR, filename)
        if os.path.getmtime(filepath) < current_time - 86400:  # 24小时
            try:
                os.remove(filepath)
            except:
                pass

if __name__ == '__main__':
    # 启动时清理旧图片
    cleanup_old_images()
    # 启动服务器
    app.run(debug=True, host='0.0.0.0', port=8000)