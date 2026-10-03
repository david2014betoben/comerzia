import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

@Injectable()
export class MockPayService {
  async createPaymentIntent(amount: number, orderId: number) {
    const baseUrl = process.env.MOCKPAY_BASE_URL;
    const secretKey = process.env.MOCKPAY_SECRET_KEY;

    if (!baseUrl || !secretKey) {
      throw new InternalServerErrorException(
        'Falta configurar MOCKPAY_BASE_URL o MOCKPAY_SECRET_KEY',
      );
    }

    const response = await fetch(
      `${baseUrl.replace(/\/$/, '')}/api/v1/payments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'USD',
          metadata: { order_id: String(orderId) },
        }),
      },
    );

    const data = (await response.json().catch(() => null)) as {
      id_transaccion?: string;
      checkout_url?: string;
    } | null;

    if (!response.ok || !data?.id_transaccion || !data.checkout_url) {
      throw new BadGatewayException(
        'MockPay no pudo crear la intención de pago',
      );
    }

    return {
      idTransaccion: data.id_transaccion,
      checkoutUrl: data.checkout_url,
    };
  }
}
