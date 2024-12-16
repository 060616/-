import qrcode
from PIL import Image, ImageDraw, ImageFont
import io
import os
from typing import Tuple, Optional

class Config:
    """配置类,存储常量配置"""
    
    # 卡片尺寸配置
    CARD_WIDTH = 800
    CARD_HEIGHT = 1000
    
    # 字体配置
    FONT_PATH = "fonts/STZHONGS.TTF"
    DEFAULT_FONT_SIZE = 32
    MAX_FONT_SIZE = 48
    MIN_FONT_SIZE = 24
    
    # 二维码配置
    QR_SIZE = 200
    QR_MARGIN = 50
    
    # 文字配置
    MAX_TEXT_LENGTH = 500
    TEXT_MARGIN = 40
    
    # 背景配置
    BG_TEMPLATES = [
        "templates/bg1.png",
        "templates/bg2.png",
        "templates/bg3.png"
    ]
    
    # 新增引号配置
    QUOTE_ICON_PATH = "icons/quote.png"
    QUOTE_SIZE = 60
    QUOTE_MARGIN_TOP = 40
    QUOTE_MARGIN_LEFT = 40
    
    # 新增底部文字配置
    TITLE_FONT_SIZE = 24
    URL_FONT_SIZE = 20
    BOTTOM_TEXT_MARGIN = 30
    
    # 调整文字边距
    TEXT_MARGIN_TOP = 120  # 为引号留出空间

class CardGenerator:
    """卡片生成器主类"""
    
    def __init__(self):
        self.config = Config()
        self._check_resources()
    
    def _check_resources(self):
        """检查必要的资源文件"""
        if not os.path.exists(self.config.FONT_PATH):
            raise FileNotFoundError(f"Font file not found: {self.config.FONT_PATH}")
            
        for bg in self.config.BG_TEMPLATES:
            if not os.path.exists(bg):
                raise FileNotFoundError(f"Background template not found: {bg}")
    
    def generate_qrcode(self, url: str) -> Image.Image:
        """生成二维码图片"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)
        
        qr_img = qr.make_image(fill_color="black", back_color="white")
        qr_img = qr_img.resize((self.config.QR_SIZE, self.config.QR_SIZE))
        return qr_img
    
    def _calculate_font_size(self, text: str, max_width: int, max_height: int) -> int:
        """计算最适合的字体大小"""
        font_size = self.config.DEFAULT_FONT_SIZE
        font = ImageFont.truetype(self.config.FONT_PATH, font_size)
        text_bbox = font.getbbox(text)
        
        while (text_bbox[2] > max_width or text_bbox[3] > max_height) and font_size > self.config.MIN_FONT_SIZE:
            font_size -= 2
            font = ImageFont.truetype(self.config.FONT_PATH, font_size)
            text_bbox = font.getbbox(text)
            
        return font_size
    
    def generate_card(self, text: str, url: str, title: str = "", bg_template_index: int = 0) -> Image.Image:
        """生成分享卡片"""
        # 参数验证
        if len(text) > self.config.MAX_TEXT_LENGTH:
            raise ValueError(f"Text too long, max length is {self.config.MAX_TEXT_LENGTH}")
            
        if bg_template_index >= len(self.config.BG_TEMPLATES):
            raise ValueError("Invalid background template index")
            
        # 创建背景
        bg_path = self.config.BG_TEMPLATES[bg_template_index]
        card = Image.open(bg_path).resize((self.config.CARD_WIDTH, self.config.CARD_HEIGHT))
        
        # 添加引号图标
        quote_icon = Image.open(self.config.QUOTE_ICON_PATH)
        quote_icon = quote_icon.resize((self.config.QUOTE_SIZE, self.config.QUOTE_SIZE))
        card.paste(quote_icon, (self.config.QUOTE_MARGIN_LEFT, self.config.QUOTE_MARGIN_TOP), quote_icon)
        
        # 生成二维码
        qr_img = self.generate_qrcode(url)
        qr_x = (self.config.CARD_WIDTH - self.config.QR_SIZE) // 2
        qr_y = self.config.CARD_HEIGHT - self.config.QR_SIZE - self.config.QR_MARGIN
        card.paste(qr_img, (qr_x, qr_y))
        
        draw = ImageDraw.Draw(card)
        
        # 绘制主文本
        max_text_width = self.config.CARD_WIDTH - 2 * self.config.TEXT_MARGIN
        max_text_height = qr_y - self.config.TEXT_MARGIN_TOP - self.config.BOTTOM_TEXT_MARGIN
        
        font_size = self._calculate_font_size(text, max_text_width, max_text_height)
        font = ImageFont.truetype(self.config.FONT_PATH, font_size)
        
        text_bbox = font.getbbox(text)
        text_x = (self.config.CARD_WIDTH - text_bbox[2]) // 2
        text_y = self.config.TEXT_MARGIN_TOP + (max_text_height - text_bbox[3]) // 2
        
        draw.text((text_x, text_y), text, font=font, fill="black")
        
        # 绘制底部网页信息
        title_font = ImageFont.truetype(self.config.FONT_PATH, self.config.TITLE_FONT_SIZE)
        url_font = ImageFont.truetype(self.config.FONT_PATH, self.config.URL_FONT_SIZE)
        
        # 绘制网页标题（如果有）
        if title:
            title_bbox = title_font.getbbox(title)
            title_x = (self.config.CARD_WIDTH - title_bbox[2]) // 2
            title_y = qr_y - self.config.BOTTOM_TEXT_MARGIN * 2
            draw.text((title_x, title_y), title, font=title_font, fill="#333333")
            
            # URL 在标题下方
            url_bbox = url_font.getbbox(url)
            url_x = (self.config.CARD_WIDTH - url_bbox[2]) // 2
            url_y = title_y + title_bbox[3] + 10
        else:
            # 没有标题时，URL 居中显示
            url_bbox = url_font.getbbox(url)
            url_x = (self.config.CARD_WIDTH - url_bbox[2]) // 2
            url_y = qr_y - self.config.BOTTOM_TEXT_MARGIN * 2
            
        draw.text((url_x, url_y), url, font=url_font, fill="#666666")
        
        return card
    
    def save_card(self, card: Image.Image, output_path: str):
        """保存卡片到文件"""
        # 优化图片大小
        output_buffer = io.BytesIO()
        card.save(output_buffer, format='PNG', optimize=True, quality=85)
        
        # 果文件大小超过1MB,进行进一步压缩
        if output_buffer.tell() > 1024 * 1024:
            card = card.resize((int(card.width * 0.8), int(card.height * 0.8)))
            card.save(output_path, format='PNG', optimize=True, quality=80)
        else:
            card.save(output_path, format='PNG')

def main():
    """主函数"""
    try:
        generator = CardGenerator()
        
        # 测试生成卡片
        text = "这是一段测试文字,用于生成分享卡片。"
        url = "https://example.com"
        
        card = generator.generate_card(text, url)
        generator.save_card(card, "output.png")
        print("Card generated successfully!")
        
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main() 