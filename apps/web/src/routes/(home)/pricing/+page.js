
// We are fetching products via load function because we want to trigger SSR for SEO
export async function load({ fetch }) {
    let products = [];
    
    try {
        const response = await fetch('/api/public/products')
        products = await response.json();
    } catch (error) {
        console.error('Error fetching products:', error);
    }

    return { products };
}



