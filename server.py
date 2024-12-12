from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont
import os
import time
import hashlib
from io import BytesIO
import traceback

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # 确保这行配置正确

# 配置
SAVE_DIR = "generated_cards"
if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR)

# 字体设置
font_path = os.path.join(os.path.dirname(__file__), 'fonts', 'STZHONGS.TTF')
if not os.path.exists(font_path):
    print("警告：找不到字体文件，将使用默认字体")
    font_path = None

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
        print(f"[DEBUG] 接收到请求数据: {data}")  # 添加请求数据日志
        
        text = data.get('text', '').strip()
        url = data.get('url', '').strip()

        # 验证输入
        if not text:
            return jsonify({"error": "文本内容不能为空"}), 400
        if len(text) > 500:
            return jsonify({"error": "文本内容过长"}), 400

        # 创建图片
        width = 800
        height = 400
        img = Image.new('RGB', (width, height), color='white')
        draw = ImageDraw.Draw(img)

        # 设置字体
        title_font = ImageFont.truetype(font_path, 36) if font_path else ImageFont.load_default()
        text_font = ImageFont.truetype(font_path, 24) if font_path else ImageFont.load_default()

        # 绘制边框
        border_width = 2
        draw.rectangle([border_width, border_width, width-border_width, height-border_width], 
                      outline='#666666', width=border_width)

        # 绘制文本
        padding = 40
        text_width = width - (padding * 2)
        
        # 文本换行处理
        def wrap_text(text, font, max_width):
            words = text.split()
            lines = []
            current_line = []
            
            for word in words:
                # 使用 getbbox() 替代 getsize()
                word_width = font.getbbox(word + ' ')[2]  # [2]获取宽度
                
                current_width = font.getbbox(' '.join(current_line))[2] if current_line else 0
                
                if current_width + word_width <= max_width:
                    current_line.append(word)
                else:
                    lines.append(' '.join(current_line))
                    current_line = [word]
            
            if current_line:
                lines.append(' '.join(current_line))
                
            return lines

        # 绘制文本内容
        y = padding
        lines = wrap_text(text, text_font, text_width)
        for line in lines[:8]:  # 最多显示8行
            draw.text((padding, y), line, font=text_font, fill='#333333')
            # 使用 getbbox() 替代 getsize()
            bbox = text_font.getbbox(line)
            text_height = bbox[3] - bbox[1]  # bottom - top
            y += text_height + 10

        # 绘制来源URL
        if url:
            draw.text((padding, height-padding-20), f"来源: {url[:50]}...", 
                     font=ImageFont.truetype(font_path, 16) if font_path else ImageFont.load_default(), 
                     fill='#999999')

        # 生成文件名
        filename = hashlib.md5(f"{text}{url}{time.time()}".encode()).hexdigest() + ".png"
        filepath = os.path.join(SAVE_DIR, filename)
        
        # 保存图片前打印信息
        print(f"[DEBUG] 准备保存图片到: {filepath}")
        img.save(filepath, "PNG")
        print(f"[DEBUG] 图片已保存")
        
        # 返回前打印URL
        image_url = f"http://localhost:8000/images/{filename}"
        print(f"[DEBUG] 返回图片URL: {image_url}")
        
        return jsonify({
            "imageUrl": image_url,
            "status": "success"  # 添加状态字段
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