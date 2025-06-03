exports.handler = async (event, context) => {
  console.log('=== FUNCTION STARTED ===');
  console.log('HTTP Method:', event.httpMethod);
  
  // Handle CORS for browser requests
  if (event.httpMethod === 'OPTIONS') {
    console.log('Handling CORS preflight');
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
    console.log('Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Raw body received:', event.body);
    
    // Parse the incoming data - handle different formats
    let websites = [];
    const bodyData = JSON.parse(event.body || '[]');
    
    console.log('Parsed body data type:', typeof bodyData);
    console.log('Parsed body data:', JSON.stringify(bodyData, null, 2));
    
    // Handle different data formats from n8n
    if (Array.isArray(bodyData)) {
      websites = bodyData;
      console.log('Using array data directly, count:', websites.length);
    } else if (bodyData.websites && Array.isArray(bodyData.websites)) {
      websites = bodyData.websites;
      console.log('Using websites property, count:', websites.length);
    } else if (typeof bodyData === 'object' && bodyData !== null) {
      // If it's a single object, wrap it in an array
      websites = [bodyData];
      console.log('Wrapped single object in array');
    } else {
      console.log('Invalid data format received');
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Invalid data format', 
          details: 'Expected array of lead objects',
          received: typeof bodyData
        })
      };
    }
    
    console.log('Total websites to validate:', websites.length);
    
    const validationPromises = websites.map(async (lead, index) => {
      console.log(`Processing lead ${index + 1}:`, lead.company_name, 'Website:', lead.website);
      
      let valid = false;
      let status = 'no_website';
      
      if (lead.website && lead.website.trim() !== '') {
        try {
          let url = lead.website;
          if (!url.startsWith('http')) {
            url = 'https://' + url;
          }
          
          console.log(`Validating URL: ${url}`);
          
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
          
          console.log(`Validation result for ${url}: valid=${valid}, status=${status}`);
          
        } catch (error) {
          valid = false;
          status = 'error';
          console.log(`Validation error for ${lead.website}:`, error.message);
        }
      } else {
        console.log(`No website provided for ${lead.company_name}`);
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
    
    console.log('Validation complete. Results count:', results.length);
    console.log('Validation summary:', results.map(r => ({ 
      company: r.company_name, 
      website: r.website, 
      valid: r.website_validation.valid,
      status: r.website_validation.status 
    })));
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ leads: results })
    };
    
  } catch (error) {
    console.log('Function error:', error.message);
    console.log('Error stack:', error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Validation failed', 
        details: error.message,
        stack: error.stack
      })
    };
  }
};
