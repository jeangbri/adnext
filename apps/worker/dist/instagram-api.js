"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendDM = sendDM;
exports.sendPrivateReply = sendPrivateReply;
exports.replyComment = replyComment;
const axios_1 = __importDefault(require("axios"));
const utils_1 = require("./utils");
const GRAPH_URL = 'https://graph.facebook.com/v21.0';
async function sendDM(accessToken, recipientId, text, imageUrl, buttons) {
    try {
        const decryptedToken = (0, utils_1.decrypt)(accessToken).trim();
        const url = `${GRAPH_URL}/me/messages?access_token=${decryptedToken}`;
        let message = { text };
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
        }
        else if (buttons && buttons.length > 0) {
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
        const res = await axios_1.default.post(url, {
            recipient: { id: recipientId },
            message: message
        });
        return res.data;
    }
    catch (e) {
        console.error('Send DM Error', e.response?.data || e.message);
        throw new Error(JSON.stringify(e.response?.data || e.message));
    }
}
async function sendPrivateReply(accessToken, commentId, text, imageUrl, buttons) {
    try {
        const decryptedToken = (0, utils_1.decrypt)(accessToken).trim();
        const url = `${GRAPH_URL}/me/messages?access_token=${decryptedToken}`;
        let message = { text };
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
        }
        else if (buttons && buttons.length > 0) {
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
        const res = await axios_1.default.post(url, {
            recipient: { comment_id: commentId },
            message: message
        });
        return res.data;
    }
    catch (e) {
        console.error('Send Private Reply Error', e.response?.data || e.message);
        throw new Error(JSON.stringify(e.response?.data || e.message));
    }
}
async function replyComment(accessToken, commentId, text) {
    try {
        const decryptedToken = (0, utils_1.decrypt)(accessToken).trim();
        const res = await axios_1.default.post(`${GRAPH_URL}/${commentId}/replies`, {
            message: text
        }, {
            params: { access_token: decryptedToken }
        });
        return res.data;
    }
    catch (e) {
        console.error('Reply Comment Error', e.response?.data || e.message);
        throw new Error(JSON.stringify(e.response?.data || e.message));
    }
}
