// Shopify-backed sections disabled for now — re-enable when we reconnect Shopify.
// import { Carousel } from 'components/carousel';
// import { ThreeItemGrid } from 'components/grid/three-items';
import Footer from 'components/layout/footer';
// Shopify retrieval disabled for now — re-enable when we reconnect Shopify.
// import shopifyHydrogenClient, { getShopData } from 'lib/shopify/shopifyHydrogenClient';

export const metadata = {
  description: 'High-performance ecommerce store built with Next.js, Vercel, and Shopify.',
  openGraph: {
    type: 'website'
  }
};

// const storeAPIURL = shopifyHydrogenClient.getStorefrontApiUrl();
// console.log('### storeAPIURL: ', storeAPIURL);

export default async function HomePage() {
  // const shopData = await getShopData();
  // console.log('### shopData: ', shopData?.props?.data?.shop);

  // const shopProducts = await getShopProducts();
  // console.log('### shopProducts: ', shopProducts.props.errors);

  return (
    <>
      {/* <ThreeItemGrid /> */}
      {/* <Carousel /> */}
      <Footer />
    </>
  );
}
