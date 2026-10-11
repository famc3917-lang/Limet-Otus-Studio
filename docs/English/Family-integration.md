# Limet Otus Family Integration

AI assistance was used in the development of this software.

## 1. Product roles

| Product | Role | Status |
| --- | --- | --- |
| Limet Otus Studio (观隅鸮馆) | Orders, schedules, production and editing tasks, members, finances and delivery | V3.0.0 in development |
| Limetkura (观隅蔵) | Image cataloguing, selection and batch adjustment, starting with a JPG prototype | Planned |
| Limetan (观隅庵) | Pixel editing, layers and creative compositing | Future |

Studio covers the business workflow; organising and editing images belong to Limetkura and Limetan. Neither has been released: apart from the read-only interface in section 2, the integration described here is a design direction and is not yet implemented.

## 2. Available: read-only order reference

Lets later products associate images with orders. GET only; requires `business:read` (session or API key).

The `X-Limet-Family-Protocol` header is optional; when present it must be `1`, otherwise the response is 426.

### Capabilities

```
GET /api/v1/family/capabilities
```

```json
{
  "family": "Limet Otus",
  "product": "studio",
  "applicationVersion": "3.0.0",
  "protocol": 1,
  "capabilities": ["order.reference.read"],
  "plannedProducts": ["Limetkura", "Limetan"]
}
```

### Order reference

```
GET /api/v1/family/orders/<order-id>
```

Order IDs are 1–120 letters, digits, `_` or `-`. Orders whose records were cleared under the retention rules return 404.

```json
{
  "protocol": 1,
  "reference": {
    "workspaceId": "…",
    "orderId": "…",
    "orderNo": "…",
    "customerName": "…",
    "shootTime": "2026-10-20T10:00",
    "location": "…",
    "stage": "post",
    "flow": null,
    "deliveredAt": null
  }
}
```

The reference carries only what is needed to associate images. It excludes amounts, notes, client contact details and payment proofs.

## 3. Identifiers

Later products should store `workspaceId` + `orderId` as the association key; `orderNo` is for display only and may change under business rules.

## 4. Planned integration

Not implemented; interfaces and formats will be defined in later versions:

1. Images entering Limetkura from a Studio order keep that association; selected and adjusted versions return to the order.
2. When local retouching or compositing is needed, Limetkura hands selected versions to Limetan, and finished work returns to Studio for delivery.
3. Write interfaces will get their own version and permissions and will not reuse the current read-only protocol.

## 5. Compatibility

- A new protocol number signals an incompatible change. Clients should read `capabilities` and use only listed capabilities.
- Within a protocol number, fields may be added but never removed or redefined.
