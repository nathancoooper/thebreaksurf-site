type ResendClient = import('resend').Resend;

let _resend: Promise<ResendClient> | null = null;

// Dynamic import keeps the Resend SDK out of the worker's cold-start module
// evaluation (same rationale as lib/stripe.ts — free tier 10ms CPU budget).
export function getResend(): Promise<ResendClient> {
  if (!_resend) {
    _resend = import('resend').then(m => new m.Resend(process.env.RESEND_API_KEY));
  }
  return _resend;
}

export const FROM_EMAIL = 'The Break Surf <orders@thebreaksurf.co.uk>';
export const REPLY_TO = 'nathan@thebreaksurf.co.uk';

const LOGO_PATH = 'M27.336,48.947C27.977,48.199 28.313,47.689 28.669,46.92C28.99,46.228 29.09,46.14 30.076,45.673C32.06,44.735 32.507,43.275 32.043,39.249C31.917,38.122 31.906,37.094 33.163,37.08C33.517,37.077 33.984,37.059 34.201,37.042C35.193,36.964 37.307,36.982 37.01,37.319C36.509,37.889 35.807,38.956 35.745,40.06C35.715,40.604 35.654,40.615 35.088,40.433C34.48,40.237 34.168,40.351 34.193,40.758C34.22,41.196 34.578,41.29 35.293,41.048C35.694,40.912 35.719,40.914 35.745,41.088C35.849,41.76 35.563,42.176 34.657,42.676C34.071,42.999 33.769,43.32 33.769,43.62C33.769,43.945 34.059,43.841 34.48,43.366C34.919,42.871 35.217,42.667 35.538,42.644C35.908,42.618 35.954,42.767 35.878,43.76C35.858,44.017 35.835,44.328 35.826,44.45C35.805,44.74 35.805,45.628 35.826,45.88C35.883,46.572 35.503,46.773 34.077,46.805C32.577,46.84 31.985,47.061 31.262,47.858C30.72,48.456 30.114,48.761 28.186,49.408C27.434,49.716 26.535,49.913 27.336,48.947ZM8.634,46.924C8.55,46.838 8.754,46.453 9.181,45.892C9.272,45.772 9.405,45.563 9.997,44.77C10.543,44.039 10.635,43.9 10.985,43.274C11.692,42.009 11.703,41.742 11.058,41.492C10.627,41.325 10.548,41.233 10.476,40.81C10.389,40.301 10.175,39.63 9.988,39.286C9.31,38.037 8.877,37.416 8.208,36.735C7.082,35.588 8.031,35.573 9.774,36.709C10.557,37.22 11.174,37.833 11.783,38.707C12.966,40.403 13.49,40.755 14.827,40.751C15.711,40.749 15.977,40.67 16.304,40.318C16.507,40.098 16.61,40.173 16.597,40.534C16.571,41.221 15.967,42.038 15.485,42.221C15.278,42.299 15.197,42.304 14.691,42.269C13.705,42.202 13.463,42.324 13.075,43.088C12.408,44.398 10.952,45.887 9.567,46.673C9.28,46.837 8.7,46.993 8.634,46.924ZM27.574,46.631C27.467,46.505 27.466,46.382 27.567,45.945C27.842,44.762 28.001,43.56 28.109,42.354C28.204,41.289 28.177,40.389 28.031,39.422C27.86,38.287 27.697,37.107 27.104,36.106C27.028,35.996 27.024,35.975 26.993,35.611C26.929,34.848 26.778,34.245 26.436,33.395C26.197,32.8 26.26,32.662 26.691,32.828C27.443,33.118 28.096,33.635 29.567,35.107C30.84,36.381 31.152,36.752 31.545,37.462C32.386,38.98 30.376,40.474 30.279,40.545C30.159,40.632 30.171,40.691 30.331,40.735C31.425,41.037 31.663,41.232 31.771,41.919C31.881,42.623 31.506,43.951 30.934,44.486C30.589,44.809 30.389,44.647 30.355,43.969C30.348,43.669 30.284,43.376 30.231,43.082C30.115,42.435 29.667,41.445 29.546,41.566C29.487,41.625 29.494,41.674 29.606,41.993C29.999,43.107 30.175,43.856 30.179,44.43C30.184,45.029 30.253,44.972 29.373,45.439C29.079,45.595 28.849,45.766 28.491,46.156C28.005,46.686 27.737,46.825 27.574,46.631ZM29.794,39.348C29.969,39.136 30.219,38.351 30.169,38.17C30.078,37.842 29.484,37.658 29.378,37.926C29.329,38.049 29.468,38.66 29.514,39.114C29.545,39.426 29.654,39.517 29.794,39.348ZM36.813,46.547C36.385,46.442 36.233,46.338 36.247,45.337C36.27,43.667 36.368,42.71 36.31,42.084C36.256,41.505 36.234,40.495 36.269,40.223C36.277,40.162 36.289,40.056 36.298,39.989C36.462,38.598 37.722,37.532 39.204,37.527C40.07,37.525 40.233,37.594 40.085,38.273C39.705,40.02 39.637,42.183 39.911,43.806C40.015,44.426 40.179,45.229 40.31,45.693C40.347,45.826 40.284,45.978 40.152,46.011C39.949,46.062 39.56,46.17 39.349,46.203C39.214,46.225 39.021,46.147 38.944,46.033C38.573,45.483 38.462,44.497 38.366,43.862C38.281,43.093 38.245,42.788 38.054,42.826C37.775,42.882 37.931,43.835 38.298,45.165C38.418,45.698 38.829,46.312 38.08,46.444C37.662,46.505 37.237,46.636 36.813,46.547ZM38.153,42.043C38.179,41.988 38.177,41.935 38.143,41.734C38.059,41.24 38.07,40.037 38.186,39.684C38.231,39.547 38.18,39.488 38.106,39.578C37.869,39.868 37.69,41.81 37.886,42.059C37.949,42.139 38.11,42.133 38.153,42.043ZM25.691,45.998C23.871,45.736 23.129,45.251 23.46,44.249C23.488,44.164 24.197,41.415 23.755,39.536C23.618,38.953 23.679,38.833 24.359,38.356C25.067,37.859 25.841,37.504 26.335,36.865C26.659,36.445 26.803,36.468 27.04,36.977C27.624,38.229 27.397,39.853 26.505,40.802C26.207,41.119 26.209,41.125 26.66,41.419C27.714,42.107 27.94,43.042 27.446,44.671C27.087,45.856 26.707,46.143 25.691,45.998ZM25.597,44.192C26.102,43.859 26.245,43.375 25.934,43.054C25.718,42.832 25.657,42.854 25.612,43.168C25.568,43.471 25.514,43.739 25.448,43.967C25.371,44.237 25.419,44.309 25.597,44.192ZM25.791,40.118C26.118,39.684 26.195,39.138 25.93,39.138C25.639,39.138 25.575,39.252 25.602,39.726C25.629,40.207 25.666,40.284 25.791,40.118ZM40.962,45.719C40.58,45.655 40.607,45.467 40.425,44.693C40.12,43.398 40.073,42.122 40.171,40.927C40.296,39.386 40.489,38.298 40.714,37.855C40.787,37.712 40.833,37.708 41.526,37.786C43.671,38.028 44.402,38.321 44.005,38.653C43.435,39.128 42.741,40.353 42.741,40.883C42.741,41.449 44.278,40.451 45.152,39.318C45.539,38.817 45.58,38.812 46.623,39.146C48.245,39.666 49.126,40.087 49.125,40.343C49.124,40.686 47.894,41.831 46.664,42.633C46.209,42.93 46.044,43.116 45.217,42.719C44.337,42.296 43.553,42.164 42.98,42.159C42.265,42.153 41.982,42.363 42.523,42.737C42.783,42.915 44.57,43.523 45.167,43.618C45.375,43.65 45.104,43.901 44.856,44.177C44.566,44.498 44.031,44.785 43.688,44.803C43.282,44.824 43.002,44.756 42.53,44.173C42.099,43.639 41.88,43.247 41.914,43.548C41.937,43.749 42.328,44.708 42.636,45.049C43.006,45.459 41.448,45.799 40.962,45.719ZM22.221,44.774C21.74,44.617 20.702,44.319 20.28,43.715C19.754,42.96 19.792,41.844 19.878,40.983C20.006,39.669 20.158,39.684 21.001,39.411C22.94,38.784 22.779,38.748 22.808,39.813C22.84,40.984 22.809,41.044 22.294,40.803C21.712,40.53 21.261,40.565 21.173,40.889C21.091,41.194 21.352,41.332 21.751,41.195C22.067,41.086 22.127,41.13 22.062,41.424C22.017,41.627 21.872,41.819 21.638,41.987C21.183,42.314 21.078,42.478 21.186,42.688C21.283,42.875 21.438,42.853 21.798,42.602C22.387,42.19 22.584,42.237 22.529,42.778C22.486,43.197 22.49,43.634 22.54,44.065C22.631,44.839 22.604,44.898 22.221,44.774ZM16.121,44.036C16.009,43.98 16.027,43.833 16.189,43.476C16.834,42.062 16.941,40.872 16.563,39.307C16.412,38.682 16.547,38.62 17.131,39.047C17.813,39.547 18.025,39.908 18.043,40.605C18.059,41.218 18.108,41.342 18.298,41.255C18.399,41.209 18.43,41.103 18.448,40.742C18.476,40.179 18.582,40.083 19.346,39.925C19.764,39.839 19.839,39.866 19.783,40.204C19.664,40.927 19.636,40.935 19.586,41.923C19.555,42.537 19.599,42.955 19.619,43.107C19.702,43.727 19.705,43.724 19.291,43.56C18.489,43.242 18.361,43.069 18.442,42.416C18.484,42.07 18.434,41.948 18.246,41.948C18.067,41.948 17.997,42.041 17.847,42.478C17.653,43.045 17.434,43.415 17.176,43.614C16.798,43.906 16.277,44.115 16.121,44.036Z';

function pence(amount: number) {
  return `£${(amount / 100).toFixed(2)}`;
}

export interface OrderItem {
  name: string;
  description: string;
  quantity: number;
  unitAmount: number;
  imageUrl?: string | null;
}

export interface OrderConfirmationProps {
  to: string;
  customerName: string;
  orderReference: string;
  items: OrderItem[];
  subtotal: number;
  shippingAmount: number;
  total: number;
  shippingAddress: {
    line1: string;
    line2?: string | null;
    city: string;
    postalCode: string;
    country: string;
  };
}

function logoSvg() {
  return `<svg viewBox="0 0 2451 1000" xmlns="http://www.w3.org/2000/svg" width="120" height="49" style="display:block;">
    <g transform="matrix(59.179048,0,0,59.179048,-456.868465,-1938.868386)">
      <path d="${LOGO_PATH}" fill="#d97706" fill-rule="nonzero"/>
    </g>
  </svg>`;
}

export function orderConfirmationHtml(props: OrderConfirmationProps): string {
  const { customerName, orderReference, items, subtotal, shippingAmount, total, shippingAddress } = props;

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #f0ede8;vertical-align:top;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            ${item.imageUrl ? `
            <td style="width:64px;vertical-align:top;padding-right:14px;">
              <img src="${item.imageUrl}" width="64" height="64"
                style="display:block;width:64px;height:64px;object-fit:cover;border-radius:3px;background:#f5f2ec;"
                alt="${item.name}" />
            </td>` : ''}
            <td style="vertical-align:top;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#1c1c1c;font-family:Georgia,serif;">${item.name}</p>
              <p style="margin:3px 0 0;font-size:12px;color:#888;font-family:Arial,sans-serif;">${item.description}</p>
              <p style="margin:6px 0 0;font-size:12px;color:#555;font-family:Arial,sans-serif;">Qty ${item.quantity}</p>
            </td>
            <td style="vertical-align:top;text-align:right;white-space:nowrap;">
              <p style="margin:0;font-size:14px;color:#1c1c1c;font-family:Arial,sans-serif;">${pence(item.unitAmount * item.quantity)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const addressDisplay = [
    shippingAddress.line1,
    shippingAddress.line2,
    shippingAddress.city,
    shippingAddress.postalCode,
  ].filter(Boolean).join('<br>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Order confirmed — ${orderReference}</title>
</head>
<body style="margin:0;padding:0;background:#f5f2ec;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ec;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <!-- Logo -->
  <tr><td align="center" style="padding:32px 0 24px;">
    <a href="https://thebreaksurf.co.uk" style="display:inline-block;text-decoration:none;">
      ${logoSvg()}
    </a>
  </td></tr>

  <!-- Card -->
  <tr><td style="background:#ffffff;border-radius:6px;overflow:hidden;">

    <!-- Hero text -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:36px 36px 0;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#c4622d;font-family:Arial,sans-serif;">
          Order confirmed
        </p>
        <p style="margin:0 0 12px;font-size:26px;font-weight:500;color:#1c1c1c;font-family:Georgia,serif;line-height:1.2;">
          Thank you, ${customerName}.
        </p>
        <p style="margin:0;font-size:14px;color:#666;line-height:1.6;font-family:Arial,sans-serif;">
          Your order is confirmed. We make in small batches so please allow 3–5 working days before dispatch. You'll get a separate email with tracking once it's on its way.
        </p>
      </td></tr>

      <!-- Order ref -->
      <tr><td style="padding:20px 36px 0;">
        <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#aaa;font-family:Arial,sans-serif;">
          Order reference
        </p>
        <p style="margin:4px 0 0;font-size:15px;font-family:monospace;color:#1c1c1c;letter-spacing:0.05em;">
          ${orderReference}
        </p>
      </td></tr>

      <!-- Divider -->
      <tr><td style="padding:24px 36px 0;">
        <div style="height:1px;background:#f0ede8;"></div>
      </td></tr>

      <!-- Items -->
      <tr><td style="padding:0 36px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${itemRows}
        </table>
      </td></tr>

      <!-- Totals -->
      <tr><td style="padding:16px 36px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#888;padding:3px 0;font-family:Arial,sans-serif;">Subtotal</td>
            <td style="text-align:right;font-size:13px;color:#888;padding:3px 0;font-family:Arial,sans-serif;">${pence(subtotal)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#888;padding:3px 0;font-family:Arial,sans-serif;">Shipping</td>
            <td style="text-align:right;font-size:13px;color:#888;padding:3px 0;font-family:Arial,sans-serif;">${shippingAmount === 0 ? 'Free' : pence(shippingAmount)}</td>
          </tr>
          <tr>
            <td style="padding-top:12px;border-top:1px solid #f0ede8;font-size:15px;font-weight:600;color:#1c1c1c;font-family:Arial,sans-serif;">Total</td>
            <td style="text-align:right;padding-top:12px;border-top:1px solid #f0ede8;font-size:15px;font-weight:600;color:#1c1c1c;font-family:Arial,sans-serif;">${pence(total)}</td>
          </tr>
        </table>
      </td></tr>

      <!-- Divider -->
      <tr><td style="padding:28px 36px 0;">
        <div style="height:1px;background:#f0ede8;"></div>
      </td></tr>

      <!-- Shipping address -->
      <tr><td style="padding:24px 36px 0;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#aaa;font-family:Arial,sans-serif;">
          Shipping to
        </p>
        <div style="border-radius:12px;border:1px solid #ece9e3;background:#faf9f6;padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#1c1c1c;line-height:1.8;font-family:Arial,sans-serif;">${addressDisplay}</p>
        </div>
      </td></tr>

      <!-- Divider -->
      <tr><td style="padding:28px 36px 0;">
        <div style="height:1px;background:#f0ede8;"></div>
      </td></tr>

      <!-- Thank you -->
      <tr><td style="padding:28px 36px 36px;text-align:center;">
        <p style="margin:0 0 12px;font-size:32px;line-height:1;">&#x1F49A;</p>
        <p style="margin:0 0 8px;font-size:18px;font-weight:500;color:#1c1c1c;font-family:Georgia,serif;">
          Made properly. Just for you.
        </p>
        <p style="margin:0;font-size:13px;color:#888;line-height:1.6;font-family:Arial,sans-serif;">
          Questions? Reply to this email or write to
          <a href="mailto:nathan@thebreaksurf.co.uk" style="color:#c4622d;text-decoration:none;">nathan@thebreaksurf.co.uk</a>
        </p>
      </td></tr>

    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px;text-align:center;">
    <p style="margin:0 0 8px;font-size:11px;color:#aaa;font-family:Arial,sans-serif;">
      The Break Surf · thebreaksurf.co.uk
    </p>
    <p style="margin:0;font-size:11px;font-family:Arial,sans-serif;">
      <a href="https://thebreaksurf.co.uk/returns" style="color:#aaa;text-decoration:none;">Returns</a>
      &nbsp;·&nbsp;
      <a href="https://thebreaksurf.co.uk/shipping" style="color:#aaa;text-decoration:none;">Shipping</a>
      &nbsp;·&nbsp;
      <a href="https://thebreaksurf.co.uk/privacy" style="color:#aaa;text-decoration:none;">Privacy</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export interface DispatchNotificationProps {
  to: string;
  customerName: string;
  orderReference: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
}

export function dispatchNotificationHtml(props: DispatchNotificationProps): string {
  const { customerName, orderReference, trackingNumber, trackingUrl, carrier } = props;

  const trackingBlock = trackingNumber ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
      <tr><td style="background:#f9f7f4;border-radius:4px;padding:20px;text-align:center;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#aaa;font-family:Arial,sans-serif;">Tracking reference</p>
        <p style="margin:0 0 14px;font-size:18px;font-family:monospace;color:#1c1c1c;letter-spacing:0.05em;">${trackingNumber}</p>
        ${trackingUrl ? `<a href="${trackingUrl}" style="display:inline-block;background:#c4622d;color:#f2ede3;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding:10px 24px;border-radius:3px;font-family:Arial,sans-serif;">Track your order${carrier ? ` via ${carrier}` : ''}</a>` : ''}
      </td></tr>
    </table>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ec;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ec;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td align="center" style="padding:32px 0 24px;">
    <a href="https://thebreaksurf.co.uk" style="display:inline-block;text-decoration:none;">${logoSvg()}</a>
  </td></tr>

  <tr><td style="background:#ffffff;border-radius:6px;padding:36px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#c4622d;font-family:Arial,sans-serif;">On its way</p>
    <p style="margin:0 0 12px;font-size:26px;font-weight:500;color:#1c1c1c;font-family:Georgia,serif;">Your order is dispatched.</p>
    <p style="margin:0;font-size:14px;color:#666;line-height:1.6;font-family:Arial,sans-serif;">
      Hi ${customerName}, your order <span style="font-family:monospace;">${orderReference}</span> has left us and is on its way to you.
    </p>
    ${trackingBlock}
    <p style="margin:28px 0 0;font-size:13px;color:#888;line-height:1.6;font-family:Arial,sans-serif;">
      Questions? Reply to this email or write to
      <a href="mailto:nathan@thebreaksurf.co.uk" style="color:#c4622d;text-decoration:none;">nathan@thebreaksurf.co.uk</a>
    </p>
  </td></tr>

  <tr><td style="padding:24px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#aaa;font-family:Arial,sans-serif;">The Break Surf · thebreaksurf.co.uk</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendOrderConfirmation(props: OrderConfirmationProps) {
  const resend = await getResend();
  return resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to: props.to,
    subject: `Order confirmed — ${props.orderReference}`,
    html: orderConfirmationHtml(props),
  });
}

export async function sendDispatchNotification(props: DispatchNotificationProps) {
  const resend = await getResend();
  return resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to: props.to,
    subject: `Your order is on its way — ${props.orderReference}`,
    html: dispatchNotificationHtml(props),
  });
}

export interface ReviewRequestItem {
  name: string;
  imageUrl?: string | null;
  reviewUrl: string;
}

export interface ReviewRequestProps {
  to: string;
  customerName: string;
  orderReference: string;
  items: ReviewRequestItem[];
}

export function reviewRequestHtml(props: ReviewRequestProps): string {
  const { customerName, orderReference, items } = props;

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #f0ede8;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            ${item.imageUrl ? `
            <td style="width:56px;vertical-align:middle;padding-right:14px;">
              <img src="${item.imageUrl}" width="56" height="56"
                style="display:block;width:56px;height:56px;object-fit:cover;border-radius:3px;background:#f5f2ec;"
                alt="${item.name}" />
            </td>` : ''}
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#1c1c1c;font-family:Georgia,serif;">${item.name}</p>
            </td>
            <td style="vertical-align:middle;text-align:right;white-space:nowrap;">
              <a href="${item.reviewUrl}" style="display:inline-block;background:#c4622d;color:#f2ede3;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;padding:8px 16px;border-radius:3px;font-family:Arial,sans-serif;">Leave a review</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ec;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ec;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td align="center" style="padding:32px 0 24px;">
    <a href="https://thebreaksurf.co.uk" style="display:inline-block;text-decoration:none;">${logoSvg()}</a>
  </td></tr>

  <tr><td style="background:#ffffff;border-radius:6px;padding:36px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#c4622d;font-family:Arial,sans-serif;">Two weeks in</p>
    <p style="margin:0 0 12px;font-size:26px;font-weight:500;color:#1c1c1c;font-family:Georgia,serif;">How's it working out?</p>
    <p style="margin:0;font-size:14px;color:#666;line-height:1.6;font-family:Arial,sans-serif;">
      Hi ${customerName}, it's been a couple of weeks since order <span style="font-family:monospace;">${orderReference}</span> landed with you. We'd love to know what you think — a quick review helps other people find us and helps us make better stuff.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      ${itemRows}
    </table>

    <p style="margin:28px 0 0;font-size:13px;color:#888;line-height:1.6;font-family:Arial,sans-serif;">
      Something not right? Just reply to this email or write to
      <a href="mailto:nathan@thebreaksurf.co.uk" style="color:#c4622d;text-decoration:none;">nathan@thebreaksurf.co.uk</a> — we'll sort it.
    </p>
  </td></tr>

  <tr><td style="padding:24px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#aaa;font-family:Arial,sans-serif;">The Break Surf · thebreaksurf.co.uk</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export interface NewOrderAlertProps {
  orderReference: string;
  customerName: string;
  customerEmail: string;
  total: number;
  items: { name: string; description: string; quantity: number }[];
  shippingAddressLine: string;
}

export function newOrderAlertHtml(props: NewOrderAlertProps): string {
  const { orderReference, customerName, customerEmail, total, items, shippingAddressLine } = props;

  const itemRows = items.map(i => `
    <tr>
      <td style="padding:8px 8px 8px 0;border-bottom:1px solid #f0ede8;color:#1c1c1c;">${i.name}</td>
      <td style="padding:8px;border-bottom:1px solid #f0ede8;color:#555;">${i.description || '—'}</td>
      <td style="padding:8px 0 8px 8px;border-bottom:1px solid #f0ede8;color:#1c1c1c;text-align:right;">${i.quantity}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ec;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ec;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td align="center" style="padding:32px 0 24px;">
    ${logoSvg()}
  </td></tr>

  <tr><td style="background:#ffffff;border-radius:6px;padding:36px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#c4622d;font-family:Arial,sans-serif;">New order</p>
    <p style="margin:0 0 20px;font-size:26px;font-weight:500;color:#1c1c1c;font-family:Georgia,serif;">${pence(total)} — ${orderReference}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;color:#333;">
      <tr><td style="padding:6px 0;color:#888;width:110px;vertical-align:top;">Customer</td><td style="padding:6px 0;">${customerName} (${customerEmail})</td></tr>
      <tr><td style="padding:6px 0;color:#888;vertical-align:top;">Ship to</td><td style="padding:6px 0;">${shippingAddressLine}</td></tr>
    </table>

    <p style="margin:20px 0 4px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#aaa;font-family:Arial,sans-serif;">Items</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;">
      <tr>
        <td style="padding:6px 8px 6px 0;border-bottom:1px solid #ddd8ce;color:#888;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Product</td>
        <td style="padding:6px 8px;border-bottom:1px solid #ddd8ce;color:#888;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Variant</td>
        <td style="padding:6px 0 6px 8px;border-bottom:1px solid #ddd8ce;color:#888;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;text-align:right;">Qty</td>
      </tr>
      ${itemRows}
    </table>
  </td></tr>

  <tr><td style="padding:24px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#aaa;font-family:Arial,sans-serif;">The Break Surf · thebreaksurf.co.uk</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendReviewRequest(props: ReviewRequestProps) {
  const resend = await getResend();
  return resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to: props.to,
    subject: `How's ${props.items[0]?.name ?? 'your order'} working out?`,
    html: reviewRequestHtml(props),
  });
}

export interface DailyHealthMetric {
  high: number | null;
  low: number | null;
}

export interface DailyHealthReportProps {
  to: string;
  dateLabel: string;
  cpu: DailyHealthMetric;
  memory: DailyHealthMetric;
  temp: DailyHealthMetric;
  latencyMs: DailyHealthMetric;
  uptimePercent: number | null;
  lastRestart: string;
  salesCount: number;
  salesTotal: number;
}

const BAR_WIDTH = 300;

// A table-based horizontal bar showing where the low-high range for the day
// sat within [min, max]. Uses explicit pixel widths (not %) since Outlook's
// rendering engine is unreliable with percentage-based table cell widths.
function rangeBar(m: DailyHealthMetric, min: number, max: number): string {
  const scale = max - min || 1;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const hasRange = m.low !== null && m.high !== null;
  const low = hasRange ? clamp(m.low!) : min;
  const high = hasRange ? clamp(m.high!) : min;

  const beforePx = Math.round(((low - min) / scale) * BAR_WIDTH);
  const rangePx = hasRange ? Math.max(4, Math.round(((high - low) / scale) * BAR_WIDTH)) : 0;
  const afterPx = Math.max(0, BAR_WIDTH - beforePx - rangePx);

  const segment = (px: number, color: string) =>
    px > 0 ? `<td width="${px}" style="width:${px}px;height:6px;line-height:6px;font-size:0;background:${color};">&nbsp;</td>` : '';

  return `
    <table cellpadding="0" cellspacing="0" width="${BAR_WIDTH}" style="width:${BAR_WIDTH}px;">
      <tr>
        ${segment(beforePx, '#f0ede8')}
        ${segment(rangePx, '#c4622d')}
        ${segment(afterPx, '#f0ede8')}
      </tr>
    </table>`;
}

function metricRow(label: string, m: DailyHealthMetric, unit: string, min: number, max: number, decimals = 0): string {
  const fmt = (v: number | null) => v === null ? '—' : `${v.toFixed(decimals)}${unit}`;
  return `
    <tr>
      <td colspan="2" style="padding:14px 0 8px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#888;font-family:Arial,sans-serif;">${label}</td>
            <td style="text-align:right;font-size:13px;font-family:Arial,sans-serif;">
              <span style="color:#c4622d;font-weight:600;">${fmt(m.high)}</span> <span style="color:#bbb;">high</span>
              &nbsp;·&nbsp;
              <span style="color:#1c1c1c;font-weight:600;">${fmt(m.low)}</span> <span style="color:#bbb;">low</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0 0 14px;border-bottom:1px solid #f0ede8;">
        ${rangeBar(m, min, max)}
      </td>
    </tr>`;
}

export function dailyHealthReportHtml(props: DailyHealthReportProps): string {
  const { dateLabel, cpu, memory, temp, latencyMs, uptimePercent, lastRestart, salesCount, salesTotal } = props;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ec;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ec;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td align="center" style="padding:32px 0 24px;">${logoSvg()}</td></tr>

  <tr><td style="background:#ffffff;border-radius:6px;padding:36px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#c4622d;font-family:Arial,sans-serif;">Daily health report</p>
    <p style="margin:0 0 24px;font-size:26px;font-weight:500;color:#1c1c1c;font-family:Georgia,serif;">${dateLabel}</p>

    <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#aaa;font-family:Arial,sans-serif;">Sales, last 24h</p>
    <p style="margin:0 0 20px;font-size:20px;font-weight:500;color:#1c1c1c;font-family:Georgia,serif;">${salesCount} order${salesCount === 1 ? '' : 's'} · ${pence(salesTotal)}</p>

    <div style="height:1px;background:#f0ede8;margin-bottom:4px;"></div>

    <table width="100%" cellpadding="0" cellspacing="0">
      ${metricRow('CPU usage', cpu, '%', 0, 100, 1)}
      ${metricRow('Memory usage', memory, '%', 0, 100, 1)}
      ${metricRow('Temperature', temp, '°C', 30, 90, 1)}
      ${metricRow('Site latency', latencyMs, 'ms', 0, 1000)}
    </table>

    <div style="height:1px;background:#f0ede8;margin:20px 0;"></div>

    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
      <tr><td style="padding:6px 0;color:#888;width:140px;vertical-align:top;">Uptime, last 24h</td><td style="padding:6px 0;">${uptimePercent === null ? '—' : `${uptimePercent}%`}</td></tr>
      <tr><td style="padding:6px 0;color:#888;vertical-align:top;">Last restart</td><td style="padding:6px 0;">${lastRestart}</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#aaa;font-family:Arial,sans-serif;">The Break Surf · thebreaksurf.co.uk</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendDailyHealthReport(props: DailyHealthReportProps) {
  const resend = await getResend();
  return resend.emails.send({
    from: FROM_EMAIL,
    to: props.to,
    subject: `Daily health report — ${props.dateLabel}`,
    html: dailyHealthReportHtml(props),
  });
}

export interface ConnectivityAlertProps {
  to: string;
  failCount: number;
}

export function connectivityAlertHtml(props: ConnectivityAlertProps): string {
  const { failCount } = props;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ec;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ec;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td align="center" style="padding:32px 0 24px;">${logoSvg()}</td></tr>

  <tr><td style="background:#ffffff;border-radius:6px;padding:36px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#a32d2d;font-family:Arial,sans-serif;">Connectivity trouble</p>
    <p style="margin:0 0 12px;font-size:26px;font-weight:500;color:#1c1c1c;font-family:Georgia,serif;">The Pi can't reach the internet.</p>
    <p style="margin:0;font-size:14px;color:#666;line-height:1.6;font-family:Arial,sans-serif;">
      It has failed <strong>${failCount}</strong> consecutive connectivity checks. If this continues, the connectivity watchdog will automatically reboot it.
    </p>
  </td></tr>

  <tr><td style="padding:24px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#aaa;font-family:Arial,sans-serif;">The Break Surf · connectivity-watchdog</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export interface CacheAlertProps {
  to: string;
  failCount: number;
  checkUrl: string;
}

export function cacheAlertHtml(props: CacheAlertProps): string {
  const { failCount, checkUrl } = props;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ec;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ec;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td align="center" style="padding:32px 0 24px;">${logoSvg()}</td></tr>

  <tr><td style="background:#ffffff;border-radius:6px;padding:36px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#a32d2d;font-family:Arial,sans-serif;">Cache trouble</p>
    <p style="margin:0 0 12px;font-size:26px;font-weight:500;color:#1c1c1c;font-family:Georgia,serif;">Cloudflare stopped caching.</p>
    <p style="margin:0;font-size:14px;color:#666;line-height:1.6;font-family:Arial,sans-serif;">
      <span style="font-family:monospace;">${checkUrl}</span> has failed <strong>${failCount}</strong> consecutive checks for a Cloudflare cache HIT. Visitors may be hitting your origin server directly on every request instead of being served from the edge. Check the Cache Rule in your Cloudflare dashboard (Rules &gt; Cache Rules) to confirm it's still enabled and the zone is proxied (orange cloud).
    </p>
  </td></tr>

  <tr><td style="padding:24px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#aaa;font-family:Arial,sans-serif;">The Break Surf · cache-watchdog</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export interface UniversityDropoffAlertProps {
  studentName: string;
  studentEmail: string;
  garment: string;
  placement: string;
  colour: string;
  note?: string;
  photo?: string;
}

export function universityDropoffAlertHtml(props: UniversityDropoffAlertProps): string {
  const { studentName, studentEmail, garment, placement, colour, note, photo } = props;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thebreaksurf.co.uk';
  const photoUrl = photo ? `${appUrl}${photo}` : null;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ec;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ec;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td align="center" style="padding:32px 0 24px;">
    ${logoSvg()}
  </td></tr>

  <tr><td style="background:#ffffff;border-radius:6px;padding:36px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#c4622d;font-family:Arial,sans-serif;">University drop-off</p>
    <p style="margin:0 0 20px;font-size:26px;font-weight:500;color:#1c1c1c;font-family:Georgia,serif;">${garment}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;color:#333;">
      <tr><td style="padding:6px 0;color:#888;width:110px;vertical-align:top;">Student</td><td style="padding:6px 0;">${studentName} (${studentEmail})</td></tr>
      <tr><td style="padding:6px 0;color:#888;vertical-align:top;">Placement</td><td style="padding:6px 0;">${placement}</td></tr>
      <tr><td style="padding:6px 0;color:#888;vertical-align:top;">Thread colour</td><td style="padding:6px 0;">${colour}</td></tr>
      ${note ? `<tr><td style="padding:6px 0;color:#888;vertical-align:top;">Note</td><td style="padding:6px 0;">${note}</td></tr>` : ''}
    </table>

    ${photoUrl ? `
    <p style="margin:20px 0 4px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#aaa;font-family:Arial,sans-serif;">Placement photo</p>
    <a href="${photoUrl}"><img src="${photoUrl}" width="200" style="max-width:200px;border-radius:4px;display:block;" /></a>
    ` : ''}
  </td></tr>

  <tr><td style="padding:24px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#aaa;font-family:Arial,sans-serif;">The Break Surf · university collab</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
