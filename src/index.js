import './css/style.css';
import chatIcon from './img/chat.svg';
import Chat from './js/Chat';

document.querySelector('.brand img').src = chatIcon;
new Chat(process.env.CHAT_API_URL).init();
