exports.handler = async (event, context) => {
  console.log('=== FUNCTION STARTED ===');
  
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
    console.log('Raw body received:', event.body);
    
    let websites = [];
    const bodyData = JSON.parse(event.body || '{}');
    
    console.log('Parsed body data:', JSON.stringify(bodyData, null, 2));
    
    // Handle the specific n8n format with empty key containing JSON string
    if (bodyData[""] && typeof bodyData[""] === 'string') {
      console.log('Found n8n format with empty key containing JSON string');
      try {
        const parsedLeads = JSON.parse(bodyData[""]);
        if (Array.isArray(parsedLeads)) {
          websites = parsedLeads;
          console.log('Successfully parsed', websites.length, 'leads from JSON string');
        }
      } catch (parseError) {
        console.log('Error parsing JSON string:', parseError.message);
      }
    }
    // Handle normal array format
    else if (Array.isArray(bodyData)) {
      websites = bodyData;
      console.log('Using direct array format, count:', websites.length);
    }
    // Handle websites property
    else if (bodyData.websites && Array.isArray(bodyData.websites)) {
      websites = bodyData.websites;
      console.log('Using websites property, count:', websites.length);
    }
    
    if (websites.length === 0) {
      console.log('No websites found to validate');
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'No valid leads found',
          receivedFormat: typeof bodyData
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
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Validation failed', 
        details: error.message
      })
    };
  }
};
