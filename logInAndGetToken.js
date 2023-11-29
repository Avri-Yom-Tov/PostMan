const axios = require('axios').default;
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const { JSDOM } = require('jsdom');
const URL_LOGIN = 'https://cloud.ovdimnet.com/register/user-login.tcl';
const dotenv = require('dotenv');
dotenv.config();

const axiosInstance = axios.create({
    withCredentials: true
});

wrapper(axiosInstance);

const cookieJar = new CookieJar();

const postFormData = async (url, formData) => {
    return axiosInstance.post(url, new URLSearchParams(formData).toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        jar: cookieJar
    });
}

const extractValueFromHtml = async (response, selector) => {
    const dom = new JSDOM(response.data);
    return dom.window.document.querySelector(selector).value;
}

const logInAndGetToken = async () => {
    try {
        const initialData = { email: '', password: '' };
        const firstResponse = await postFormData(URL_LOGIN, initialData);
        const secSessionId = await extractValueFromHtml(firstResponse, "#sec_session_id");

        const loginData = {
            sec_session_id: secSessionId,
            email: process.env.EMAIL,
            password: process.env.PASSWORD,
            image1: 'login',
            return_url: ''
        };
        await postFormData(URL_LOGIN, loginData);

        const adSessionId = cookieJar.store.idx['cloud.ovdimnet.com']['/']['ad_session_id'].value;
        return adSessionId;
    } catch (error) {
        console.error('Error during session ID retrieval:', error);
        return null;
    }
}


module.exports = logInAndGetToken;

