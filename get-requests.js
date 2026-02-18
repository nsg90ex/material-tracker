exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const { AIRTABLE_BASE_ID, AIRTABLE_API_KEY, AIRTABLE_TABLE_NAME } = process.env;

    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error' })
        };
    }

    try {
        const { status } = JSON.parse(event.body || '{}');
        let filterFormula = '';

        if (status) {
            filterFormula = `IF({Status} = "${status}", TRUE(), FALSE())`;
        }

        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME || 'Requests')}?sort%5B0%5D%5Bfield%5D=Created&sort%5B0%5D%5Bdirection%5D=desc`;

        const fetchOptions = {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        if (filterFormula) {
            fetchOptions.headers['X-Airtable-Filter'] = filterFormula;
        }

        const response = await fetch(url, fetchOptions);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to fetch from Airtable');
        }

        // Transform Airtable records to our format
        const requests = data.records.map(record => ({
            id: record.id,
            partName: record.fields['Part name'] || '',
            size: record.fields['Size'] || '',
            description: record.fields['Description'] || '',
            requestDate: record.fields['Date of request'] || record.createdTime,
            status: record.fields['Status'] || 'Requested',
            requestedBy: record.fields['Requested by'] || 'Unknown',
            imageUrl: record.fields['Image']?.[0]?.url || ''
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(requests)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
