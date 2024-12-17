// import { createStorefrontApiClient } from '@shopify/storefront-api-client';
// import fetch from 'node-fetch';

// const client = createStorefrontApiClient({
//   storeDomain: 'http://your-shop-name.myshopify.com',
//   apiVersion: '2023-10',
//   privateAccessToken: 'your-storefront-private-access-token',
//   customFetchApi: fetch
// });

import { createStorefrontClient } from '@shopify/hydrogen-react';

const shopifyHydrogenClient = createStorefrontClient({
  storeDomain: 'https://shiftgreenhub.myshopify.com',
  storefrontApiVersion: '2024-10',
  privateStorefrontToken: '***REMOVED-SHOPIFY-PRIVATE-TOKEN***'
});

// make the request
export async function getShopData() {
  // Storefront API query
  const GRAPHQL_QUERY = `
    query {
      shop {
        name
      }
    }
  `;
  // Get the Storefront API url
  const response = await fetch(shopifyHydrogenClient.getStorefrontApiUrl(), {
    body: JSON.stringify({
      query: GRAPHQL_QUERY
    }),
    // Generate the headers using the private token. Additionally, you can pass in the buyer's IP address from the request object to help prevent bad actors from overloading your store.
    headers: shopifyHydrogenClient.getPrivateTokenHeaders({ buyerIp: 'TODO' }),
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  const json = await response.json();

  return { props: json };
}

// make the request
export async function getShopProducts() {
  // Storefront API query
  const GRAPHQL_QUERY = `
     {
      products(first: 10) {
        edges {
          node {
            title
          }
        }
      }
    }
  `;
  // Get the Storefront API url
  const response = await fetch(shopifyHydrogenClient.getStorefrontApiUrl(), {
    body: JSON.stringify({
      query: GRAPHQL_QUERY
    }),
    // Generate the headers using the private token. Additionally, you can pass in the buyer's IP address from the request object to help prevent bad actors from overloading your store.
    headers: shopifyHydrogenClient.getPrivateTokenHeaders({ buyerIp: 'TODO' }),
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  const json = await response.json();

  return { props: json };
}

export default shopifyHydrogenClient;
