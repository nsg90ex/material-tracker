exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { image, filename } = JSON.parse(event.body);

        // For this simple version, return a data URL
        const dataUrl = `data:image/jpeg;base64,${image}`;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ url: dataUrl })
        };
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
