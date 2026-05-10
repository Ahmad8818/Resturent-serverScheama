
import axios from 'axios';

async function testIdempotency() {
    const url = 'http://localhost:3000/api/orders';
    const payload = {
        items: [{ menuItemId: '69e32d5663f7067d02464161', quantity: 1 }],
        orderType: 'dinein',
        tableNumber: '1',
        paymentMethod: 'COD',
        customerName: 'Test'
    };

    try {
        console.log('Sending first order...');
        const res1 = await axios.post(url, payload);
        console.log('First order response:', res1.data.message);

        console.log('Sending second order (same payload, no idempotency key)...');
        const res2 = await axios.post(url, payload);
        console.log('Second order response:', res2.data.message);
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

// testIdempotency();
