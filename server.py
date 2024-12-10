from flask import Flask, request, jsonify
from flask_cors import CORS
from card_generator import CardGenerator
import base64
import io
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

generator = CardGenerator()

@app.route('/generate', methods=['POST'])
def generate_card():
    try:
        logger.info("收到卡片生成请求")
        data = request.json
        text = data.get('text', '')
        url = data.get('url', '')
        
        logger.info(f"处理文本长度: {len(text)} 字符")
        logger.info(f"处理URL: {url}")
        
        # 生成卡片
        logger.info("开始生成卡片...")
        card = generator.generate_card(text, url)
        logger.info("卡片生成完成")
        
        # 转换为base64
        logger.info("开始转换为base64...")
        buffer = io.BytesIO()
        card.save(buffer, format='PNG')
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        logger.info(f"base64转换完成,数据大小: {len(image_base64)}")
        
        return jsonify({
            'success': True,
            'imageUrl': f'data:image/png;base64,{image_base64}'
        })
        
    except Exception as e:
        logger.error(f"生成卡片失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    logger.info("卡片生成服务启动...")
    app.run(port=5000) 