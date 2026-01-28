import axios from 'axios';
import { decrypt } from './utils';

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

export async function sendDM(accessToken: string, recipientId: string, text: string, imageUrl?: string, buttons?: any[]) {
    try {
        const decryptedToken = decrypt(accessToken).trim();
        const url = `${GRAPH_URL}/me/messages?access_token=${decryptedToken}`;

        let message: any = { text };

        if (imageUrl) {
            message = {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: [{
                            title: text || " ",
                            image_url: imageUrl,
                            buttons: buttons && buttons.length > 0 ? buttons.slice(0, 3).map(b => ({
                                type: "web_url",
                                url: b.url,
                                title: b.label
                            })) : undefined
                        }]
                    }
                }
            };
        } else if (buttons && buttons.length > 0) {
            message = {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: text,
                        buttons: buttons.map(b => ({
                            type: "web_url",
                            url: b.url,
                            title: b.label
                        }))
                    }
                }
            };
        }

        const res = await axios.post(url, {
            recipient: { id: recipientId },
            message: message
        });
        return res.data;
    } catch (e: any) {
        console.error('Send DM Error', e.response?.data || e.message);
        throw new Error(JSON.stringify(e.response?.data || e.message));
    }
}

export async function sendPrivateReply(accessToken: string, commentId: string, text: string, imageUrl?: string, buttons?: any[]) {
    try {
        const decryptedToken = decrypt(accessToken).trim();
        const url = `${GRAPH_URL}/me/messages?access_token=${decryptedToken}`;

        let message: any = { text };

        if (imageUrl) {
            message = {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: [{
                            title: text || " ",
                            image_url: imageUrl,
                            buttons: buttons && buttons.length > 0 ? buttons.slice(0, 3).map(b => ({
                                type: "web_url",
                                url: b.url,
                                title: b.label
                            })) : undefined
                        }]
                    }
                }
            };
        } else if (buttons && buttons.length > 0) {
            message = {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: text,
                        buttons: buttons.map(b => ({
                            type: "web_url",
                            url: b.url,
                            title: b.label
                        }))
                    }
                }
            };
        }

        const res = await axios.post(url, {
            recipient: { comment_id: commentId },
            message: message
        });
        return res.data;
    } catch (e: any) {
        console.error('Send Private Reply Error', e.response?.data || e.message);
        throw new Error(JSON.stringify(e.response?.data || e.message));
    }
}

export async function replyComment(accessToken: string, commentId: string, text: string) {
    try {
        const decryptedToken = decrypt(accessToken).trim();
        const res = await axios.post(`${GRAPH_URL}/${commentId}/replies`, {
            message: text
        }, {
            params: { access_token: decryptedToken }
        });
        return res.data;
    } catch (e: any) {
        console.error('Reply Comment Error', e.response?.data || e.message);
        throw new Error(JSON.stringify(e.response?.data || e.message));
    }
}
