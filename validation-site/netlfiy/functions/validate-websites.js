exports.handler = async (event, context) => {
  // Handle CORS for browser requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const websites = JSON.parse(event.body || '[]');
    
    const validationPromises = websites.map(async (lead) => {
      let valid = false;
      let status = 'no_website';
      
      if (lead.website) {
        try {
          let url = lead.website;
          if (!url.startsWith('http')) {
            url = 'https://' + url;
          }
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadValidator/1.0)' }
          });
          
          clearTimeout(timeoutId);
          valid = response.status >= 200 && response.status < 400;
          status = response.status;
          
        } catch (error) {
          valid = false;
          status = 'error';
        }
      }
      
      return {
        ...lead,
        website_validation: {
          valid: valid,
          status: status
        }
      };
    });

    const results = await Promise.all(validationPromises);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ leads: results })
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Validation failed', details: error.message })
    };
  }
};