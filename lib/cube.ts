import axios from 'axios';
import { parseString } from 'xml2js';
import https from 'https';

const CUBE_NAME = 'OARS Franchise';

export async function discoverMeasures() {
  const xmlaRequest = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" 
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <SOAP-ENV:Body>
    <Discover xmlns="urn:schemas-microsoft-com:xml-analysis">
      <RequestType>MDSCHEMA_MEASURES</RequestType>
      <Restrictions>
        <RestrictionList>
          <CATALOG_NAME>${CUBE_NAME}</CATALOG_NAME>
        </RestrictionList>
      </Restrictions>
      <Properties>
        <PropertyList>
          <Catalog>${CUBE_NAME}</Catalog>
          <Format>Tabular</Format>
        </PropertyList>
      </Properties>
    </Discover>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

  const url = process.env.PAPAJOHNS_CUBE_URL || 'https://ednacubes.papajohns.com:10502/xmla/default';
  const username = process.env.PAPAJOHNS_CUBE_USER || 'sai.gurram1';
  const password = process.env.PAPAJOHNS_CUBE_PASSWORD;

  if (!password) {
    throw new Error('PAPAJOHNS_CUBE_PASSWORD environment variable is not set');
  }

  // Bypass SSL verification for corporate endpoint
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false  // bypass SSL verification for corporate endpoint
  });

  const response = await axios.post(
    url,
    xmlaRequest,
    {
      httpsAgent,  // add this
      headers: {
        'Content-Type': 'text/xml',
        'SOAPAction': 'urn:schemas-microsoft-com:xml-analysis:Discover',
        'Authorization': 'Basic ' + Buffer.from(
          `${username}:${password}`
        ).toString('base64')
      }
    }
  );

  // Parse XML response
  return new Promise((resolve, reject) => {
    parseString(response.data, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

