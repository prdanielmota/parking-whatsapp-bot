#!/usr/bin/env python3
"""
Script para reconhecimento de placas de veículos
Utiliza OpenCV e Tesseract OCR para detectar e reconhecer placas em imagens
"""

import sys
import os
import cv2
import numpy as np
import pytesseract
import re
import json
from PIL import Image

def preprocess_image(image_path):
    """
    Pré-processa a imagem para melhorar o reconhecimento
    """
    # Carregar imagem
    img = cv2.imread(image_path)
    
    if img is None:
        return None
    
    # Converter para escala de cinza
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Aplicar filtro bilateral para reduzir ruído e preservar bordas
    bilateral = cv2.bilateralFilter(gray, 11, 17, 17)
    
    # Detectar bordas
    edged = cv2.Canny(bilateral, 30, 200)
    
    return img, gray, edged

def find_plate_contour(edged, img):
    """
    Encontra o contorno da placa na imagem
    """
    # Encontrar contornos
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    # Ordenar contornos por área (do maior para o menor)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]
    
    plate_contour = None
    
    # Iterar sobre os contornos
    for contour in contours:
        # Aproximar contorno
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        
        # Se o contorno tiver 4 pontos, é provavelmente a placa
        if len(approx) == 4:
            plate_contour = approx
            break
    
    return plate_contour

def extract_plate(img, plate_contour):
    """
    Extrai a região da placa da imagem
    """
    if plate_contour is None:
        return None
    
    # Criar máscara
    mask = np.zeros(img.shape[:2], dtype=np.uint8)
    cv2.drawContours(mask, [plate_contour], 0, 255, -1)
    
    # Aplicar máscara
    masked = cv2.bitwise_and(img, img, mask=mask)
    
    # Obter região de interesse
    x, y, w, h = cv2.boundingRect(plate_contour)
    roi = masked[y:y+h, x:x+w]
    
    return roi

def recognize_plate_text(plate_img):
    """
    Reconhece o texto da placa usando OCR
    """
    if plate_img is None:
        return None, 0
    
    # Converter para escala de cinza
    gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
    
    # Aplicar limiarização adaptativa
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    
    # Configurar Tesseract
    custom_config = r'--oem 3 --psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    
    # Reconhecer texto
    text = pytesseract.image_to_string(thresh, config=custom_config)
    
    # Limpar texto
    text = text.strip().replace(' ', '').replace('\n', '')
    
    # Calcular confiança
    confidence_data = pytesseract.image_to_data(thresh, config=custom_config, output_type=pytesseract.Output.DICT)
    
    # Calcular confiança média
    if len(confidence_data['conf']) > 0:
        valid_confidences = [float(conf) for conf in confidence_data['conf'] if conf != '-1']
        confidence = sum(valid_confidences) / len(valid_confidences) if valid_confidences else 0
    else:
        confidence = 0
    
    return text, confidence

def validate_plate(text):
    """
    Valida o formato da placa
    """
    if not text:
        return False, None
    
    # Formato antigo: ABC1234
    old_format = re.compile(r'^[A-Z]{3}[0-9]{4}$')
    
    # Formato Mercosul: ABC1D23
    mercosul_format = re.compile(r'^[A-Z]{3}[0-9][A-Z][0-9]{2}$')
    
    if old_format.match(text):
        return True, text
    elif mercosul_format.match(text):
        return True, text
    
    # Tentar corrigir erros comuns
    text = text.upper()
    
    # Substituir caracteres comumente confundidos
    corrections = {
        'O': '0',
        'I': '1',
        'Z': '2',
        'S': '5',
        'G': '6',
        'B': '8'
    }
    
    # Aplicar correções apenas para posições numéricas
    corrected = list(text)
    
    # Para formato antigo (ABC1234)
    if len(text) == 7:
        for i in range(3, 7):
            if corrected[i] in corrections and not corrected[i].isdigit():
                corrected[i] = corrections[corrected[i]]
    
    # Para formato Mercosul (ABC1D23)
    elif len(text) == 7:
        for i in [3, 5, 6]:
            if corrected[i] in corrections and not corrected[i].isdigit():
                corrected[i] = corrections[corrected[i]]
    
    corrected_text = ''.join(corrected)
    
    if old_format.match(corrected_text) or mercosul_format.match(corrected_text):
        return True, corrected_text
    
    return False, None

def recognize_plate(image_path):
    """
    Reconhece a placa em uma imagem
    """
    try:
        # Pré-processar imagem
        processed = preprocess_image(image_path)
        
        if processed is None:
            return {
                'success': False,
                'message': 'Erro ao carregar imagem'
            }
        
        img, gray, edged = processed
        
        # Encontrar contorno da placa
        plate_contour = find_plate_contour(edged, img)
        
        # Se não encontrou contorno, tentar reconhecimento direto
        if plate_contour is None:
            text, confidence = recognize_plate_text(gray)
        else:
            # Extrair placa
            plate_img = extract_plate(img, plate_contour)
            
            # Reconhecer texto
            text, confidence = recognize_plate_text(plate_img)
        
        # Validar placa
        is_valid, plate_text = validate_plate(text)
        
        if not is_valid:
            return {
                'success': False,
                'message': 'Placa não reconhecida ou formato inválido',
                'raw_text': text,
                'confidence': confidence
            }
        
        return {
            'success': True,
            'licensePlate': plate_text,
            'confidence': confidence
        }
    
    except Exception as e:
        return {
            'success': False,
            'message': f'Erro ao processar imagem: {str(e)}'
        }

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({
            'success': False,
            'message': 'Uso: python plate_recognition.py <caminho_da_imagem>'
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({
            'success': False,
            'message': 'Arquivo não encontrado'
        }))
        sys.exit(1)
    
    result = recognize_plate(image_path)
    print(json.dumps(result))
