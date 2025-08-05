import cv2
import numpy as np
from PIL import Image
import io
from app.image_to_text.image_to_text import image_to_text
from app.image_to_text.text_operations import get_sentence_with_word_regex
from app.services.gemini_service import GeminiService
from app.models.card import Card
import os
import uuid
from typing import Dict, List , Any 

# Constants for image and text processing limits
MAX_IMAGE_SIZE = 10 * 1024 * 1024  
MAX_TEXT_LENGTH = 1000  

class CreateCardService:
    def __init__(self):
        self.gemini_service = GeminiService()
        
    async def process_image_and_create_cards(
        self, 
        image_content: bytes, 
        words: List[str],
        n_language: str = "Turkish",
        l_language: str = "English"
    ) -> List[Card]:
        
        """
        1. Extract text from image using OCR
        2. Find sentences for each word
        3. Generate card details using Gemini
        4. Return Card objects
        """

        if len(image_content) > MAX_IMAGE_SIZE:
            raise ValueError(f"Image size exceeds maximum limit of {MAX_IMAGE_SIZE / (1024 * 1024):.1f}MB")
        
        # OCR işlemi
        extracted_data = await self.process_image_and_extract_sentences(image_content, words)
        extracted_text = extracted_data["text"]
        sentences = extracted_data["sentences"]
        
        
        cards = []
        
        # Create cards for each word
        for word in words:
            try:
                # Find sentences for the word
                word_sentences = sentences.get(word, [])
                if not word_sentences:
                    # If no sentences found, create card with None
                    word_sentences = [None]
                for context_sentence in word_sentences:
                    try:
                        card_details = await self.gemini_service.generate_card(
                            word=word,
                            n_language=n_language,
                            l_language=l_language,
                            sentence=context_sentence
                        )
                        card = Card(
                            word=card_details.word,
                            t_word=card_details.t_word,
                            description=card_details.description,
                            synonyms=card_details.synonyms,
                            sentence=card_details.sentence,
                            t_sentence=card_details.t_sentence,
                            pronunciation=card_details.pronunciation,
                            part_of_speech=card_details.part_of_speech,
                    
                        )
                        
                        cards.append(card)
                    except Exception as e:
                        print(f"Error processing word '{word}' with sentence '{context_sentence}': {str(e)}")
                        continue
            except Exception as e:
                print(f"Error creating card for word '{word}': {str(e)}")
                continue
                
        return cards


    async def process_text_and_create_cards(
        self, 
        text: str,
        words: List[str],
        n_language: str = "Turkish",
        l_language: str = "English"
    ) -> List[Card]:
       
        
        if not text or not text.strip():
            raise ValueError("Empty text content")
            
        if not words or not isinstance(words, list):
            raise ValueError("Words must be a non-empty list")
        
        if len(text) > MAX_TEXT_LENGTH:
            raise ValueError(f"Text length exceeds maximum limit of {MAX_TEXT_LENGTH} characters")
    
        cards = []
        sentences = {}
        
        # Find sentences for each word
        for word in words:
            word_sentences = get_sentence_with_word_regex(text, word.lower())
            if word_sentences:
                sentences[word] = word_sentences
        
        # Create cards for each word
        for word in words:
            try:
                # Find sentences for the word
                word_sentences = sentences.get(word, [])
                if not word_sentences:
                    # If no sentences found, create card with None
                    word_sentences = [None]
                for context_sentence in word_sentences:
                    try:
                        card_details = await self.gemini_service.generate_card(
                            word=word,
                            n_language=n_language,
                            l_language=l_language,
                            sentence=context_sentence
                        )
                        card = Card(
                            word=card_details.word,
                            t_word=card_details.t_word,
                            description=card_details.description,
                            synonyms=card_details.synonyms,
                            sentence=card_details.sentence,
                            t_sentence=card_details.t_sentence
                        )
                        
                        cards.append(card)
                    except Exception as e:
                        print(f"Error processing word '{word}' with sentence '{context_sentence}': {str(e)}")
                        continue
            except Exception as e:
                print(f"Error creating card for word '{word}': {str(e)}")
                continue
                
        return cards

    async def process_image_and_extract_sentences(
        self, 
        image_content: bytes, 
        words: List[str]
    ) -> Dict[str, Any]:
        """Multi-server ready OCR processing"""
        if not image_content:
            raise ValueError("Empty image content")
        
        if len(image_content) > 10 * 1024 * 1024: 
            raise ValueError("Image too large")
        
        try:
            # Bytes → NumPy array 
            nparr = np.frombuffer(image_content, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                raise ValueError("Invalid image format")
            
            # OCR processing
            extracted_text = image_to_text(img)
            
            # Find sentences for each word
            results = {}
            for word in words:
                sentences = get_sentence_with_word_regex(extracted_text, word.lower())
                if sentences:
                    results[word] = sentences
            
            return {
                "text": extracted_text,
                "sentences": results
            }
            
        except Exception as e:
            raise Exception(f"OCR processing error: {str(e)}")
