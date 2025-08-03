import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Modal,
    Dimensions,
    Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Markdown from 'react-native-markdown-display'; 

const { height } = Dimensions.get('window');

const SentenceInput = ({ visible, word, onClose, onSubmit }) => {
    const [sentence, setSentence] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollViewRef = useRef(null);
    const slideAnim = useRef(new Animated.Value(height)).current;
    const [nativeLang, setNativeLang] = useState('English'); 
    const [sessionId, setSessionId] = useState(null); 
    
     useEffect(() => {
        // Load user language settings from AsyncStorage
        AsyncStorage.getItem('userLanguageSettings').then(val => {
            if (val) {
                const settings = JSON.parse(val);
                setNativeLang(settings.n_language || 'English');
            }
        });
    }, []);

    // Reset messages when word changes or modal opens
    useEffect(() => {
        if (visible) {
            setSessionId(null); 
            setSentence(''); 
            let introMsg;
            if (nativeLang === 'Turkish') {
                introMsg = [
                    'En iyi öğrenme yollarından biri pratik yapmaktır. Şimdi "', 
                    word, 
                    '" kelimesini bir cümlede kullanmaya ne dersin? Merak etme, cümleni inceleyip sana yardımcı olacağım. Sonrasında üzerinde tartışabiliriz.'
                ];
            } else {
                introMsg = [
                    'One of the best ways to learn is through practice. Now, how about using the word "', 
                    word, 
                    '" in a sentence? Don\'t worry, we will review your sentence so you can improve yourself. After that, we can discuss it further.'
                ];
            }
            setMessages([{ type: 'system', text: introMsg }]);
            
            // Slide up animation
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            }).start();
        } else {
            // Slide down animation
            Animated.timing(slideAnim, {
                toValue: height,
                duration: 300,
                useNativeDriver: true
            }).start();
        }
    }, [visible, word, slideAnim,nativeLang]);

    // Scroll to bottom when messages update
    useEffect(() => {
        if (scrollViewRef.current && messages.length > 0) {
            setTimeout(() => scrollViewRef.current.scrollToEnd({ animated: true }), 100);
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!sentence.trim() || isLoading) return;

        const userMessageText = sentence.trim();
        const userMessage = { type: 'user', text: userMessageText };
        setMessages(prev => [...prev, userMessage]);
        setSentence('');
        setIsLoading(true);

        try {
            if (!sessionId) {
                const response = await ApiService.checkSentence(word, sentence.trim());
                const systemResponse = { type: 'system', text: response.data };
                console.log('API Response:', response.data);
                setMessages(prev => [...prev, systemResponse]); 
                setSessionId(response.session_id); 
            } else {
                const response = await ApiService.continueChat(sessionId, userMessageText);
                const systemResponse = { type: 'system', text: response.data };
                setMessages(prev => [...prev, systemResponse]); 
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                type: 'system',
                text: 'Sorry, there was an error processing your message.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };


    if (!visible) return null;

    return (
        <Modal
            transparent={true}
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <Animated.View 
                    style={[
                        styles.modalContainer,
                        { transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    <View style={styles.header}>
                        <Text style={styles.headerText}>Practice with "{word}"</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.messagesContainer}
                        contentContainerStyle={styles.messagesContent}
                    >
                        {messages.map((message, index) => (
                            <View 
                                key={index} 
                                style={[
                                    styles.messageBox,
                                    message.type === 'system' ? styles.systemBox : styles.userBox
                                ]}
                            >
                                {Array.isArray(message.text) ? (
                                    <Text style={[
                                        styles.messageText,
                                        message.type === 'system' ? styles.systemText : styles.userText
                                    ]}>
                                        {message.text[0]}
                                        <Text style={styles.textBold}>{message.text[1]}</Text>
                                        {message.text[2]}
                                    </Text>
                                ) : (
                                    // BU KISMI DEĞİŞTİR:
                                    message.type === 'system' ? (
                                        <Markdown style={markdownStyles}>
                                            {message.text}
                                        </Markdown>
                                    ) : (
                                        <Text style={[styles.messageText, styles.userText]}>
                                            {message.text}
                                        </Text>
                                    )
                                )}
                            </View>
                        ))}
                        
                        {isLoading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator color="#6200ea" />
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Type your sentence..."
                            value={sentence}
                            onChangeText={setSentence}
                            multiline
                            maxLength={200}
                            autoFocus={true}
                        />
                        <TouchableOpacity 
                            style={[styles.submitButton, !sentence.trim() && styles.submitButtonDisabled]}
                            onPress={handleSendMessage}
                            disabled={!sentence.trim() || isLoading}
                        >
                            <Ionicons name="send" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const markdownStyles = {
    body: {
        fontSize: 16,
        lineHeight: 22,
        color: '#1e2a78',
    },
    heading1: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    strong: {
        fontWeight: 'bold',
        color: '#3747afff',
    },
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(30,42,120,0.18)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#f6f8fc',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '80%',
        padding: 18,
        elevation: 8,
        shadowColor: '#001233',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.13,
        shadowRadius: 10,
        borderWidth: 1,
        borderColor: '#e3e6ee',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e3e6ee',
    },
    headerText: {
        fontSize: 19,
        fontWeight: 'bold',
        color: '#1e2a78',
    },
    textBold: {
        fontWeight: 'bold',
        color: '#3747afff',
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        paddingBottom: 16,
    },
    messageBox: {
        maxWidth: '85%',
        marginBottom: 12,
        padding: 12,
        borderRadius: 14,
        elevation: 2,
        shadowColor: '#001233',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
    },
    systemBox: {
        backgroundColor: '#e3e6ee',
        alignSelf: 'flex-start',
        borderTopLeftRadius: 6,
    },
    userBox: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e3e6ee',
        alignSelf: 'flex-end',
        borderTopRightRadius: 6,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    systemText: {
        color: '#1e2a78',
    },
    userText: {
        color: '#29305e',
    },
    loadingContainer: {
        padding: 16,
        alignItems: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        backgroundColor: '#f6f8fc',
        borderTopWidth: 1,
        borderTopColor: '#e3e6ee',
        alignItems: 'flex-end',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    input: {
        flex: 1,
        backgroundColor: '#e3e6ee',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        maxHeight: 100,
        fontSize: 16,
        color: '#1e2a78',
    },
    submitButton: {
        backgroundColor: '#3747afff',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#001233',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.10,
        shadowRadius: 2,
    },
    submitButtonDisabled: {
        backgroundColor: '#ccc',
    }
});

export default SentenceInput;
