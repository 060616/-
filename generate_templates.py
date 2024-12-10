from PIL import Image
import os

def generate_white_background():
    """生成纯白色背景模板"""
    
    # 确保templates文件夹存在
    if not os.path.exists('templates'):
        os.makedirs('templates')
    
    # 创建纯白背景图片
    img = Image.new('RGB', (800, 1000), '#FFFFFF')
    
    # 保存模板
    img.save('templates/bg1.png')
    print('Generated white background template')

if __name__ == '__main__':
    generate_white_background() 