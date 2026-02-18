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
      body: JSON.stringify({ error: 'Airtable environment variables not set' })
    };
  }

  try {
    const { status } = JSON.parse(event.body || '{}');

    // Build query string for Airtable list records API
    const params = new URLSearchParams();
    // Sort by Date of request (field must exist in your table)
    params.append('sort[0][field]', 'Date of request');
    params.append('sort[0][direction]', 'desc');

    if (status) {
      // Proper filterByFormula usage for Airtable API
      params.append('filterByFormula', `{Status} = '${status}'`);
    }

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
      AIRTABLE_TABLE_NAME || 'Requests'
    )}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to fetch from Airtable');
    }

    const requests = data.records.map((record) => ({
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
    console.error('Error in get-requests:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
