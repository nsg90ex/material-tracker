exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const { AIRTABLE_BASE_ID, AIRTABLE_API_KEY, AIRTABLE_TABLE_NAME } = process.env;

    try {
        const { partName, size, description, requestDate, status, requestedBy, imageUrl } = JSON.parse(event.body);

        const fields = {
            'Part name': partName,
            'Size': size,
            'Description': description,
            'Date of request': requestDate,
            'Status': status,
            'Requested by': requestedBy
        };

        if (imageUrl) {
            fields['Image'] = [{ url: imageUrl }];
        }

        const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME || 'Requests'}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to create record');
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, id: data.id })
        };
    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
