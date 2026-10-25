import { FieldError } from "@/components/field-error";
import { REASONS, type RequestDraft } from "./types";

const control = "mt-1 w-full border border-line bg-card px-3 py-2";

export function RequestFields({
  draft,
  errors,
  onChange,
  idPrefix,
}: {
  draft: RequestDraft;
  errors: Record<string, string | undefined>;
  onChange: (draft: RequestDraft) => void;
  idPrefix: string;
}) {
  function set<K extends keyof RequestDraft>(key: K, value: RequestDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm" htmlFor={`${idPrefix}-customer-name`}>
        Customer name
        <input
          id={`${idPrefix}-customer-name`}
          className={control}
          value={draft.customerName}
          onChange={(event) => set("customerName", event.target.value)}
          aria-invalid={Boolean(errors.customerName)}
          aria-describedby={errors.customerName ? `${idPrefix}-customer-name-error` : undefined}
          required
        />
        <FieldError id={`${idPrefix}-customer-name-error`}>{errors.customerName}</FieldError>
      </label>
      <label className="text-sm" htmlFor={`${idPrefix}-email`}>
        Email
        <input
          id={`${idPrefix}-email`}
          className={control}
          type="email"
          value={draft.customerEmail}
          onChange={(event) => set("customerEmail", event.target.value)}
          aria-invalid={Boolean(errors.customerEmail)}
          aria-describedby={errors.customerEmail ? `${idPrefix}-email-error` : undefined}
          required
        />
        <FieldError id={`${idPrefix}-email-error`}>{errors.customerEmail}</FieldError>
      </label>
      <label className="text-sm" htmlFor={`${idPrefix}-phone`}>
        Phone
        <input
          id={`${idPrefix}-phone`}
          className={control}
          value={draft.customerPhone}
          onChange={(event) => set("customerPhone", event.target.value)}
          aria-invalid={Boolean(errors.customerPhone)}
          aria-describedby={errors.customerPhone ? `${idPrefix}-phone-error` : undefined}
          required
        />
        <FieldError id={`${idPrefix}-phone-error`}>{errors.customerPhone}</FieldError>
      </label>
      <label className="text-sm" htmlFor={`${idPrefix}-order`}>
        Order reference
        <input
          id={`${idPrefix}-order`}
          className={control}
          value={draft.orderReference}
          onChange={(event) => set("orderReference", event.target.value)}
          aria-invalid={Boolean(errors.orderReference)}
          aria-describedby={errors.orderReference ? `${idPrefix}-order-error` : undefined}
          required
        />
        <FieldError id={`${idPrefix}-order-error`}>{errors.orderReference}</FieldError>
      </label>
      <label className="text-sm" htmlFor={`${idPrefix}-item`}>
        Item
        <input
          id={`${idPrefix}-item`}
          className={control}
          value={draft.itemName}
          onChange={(event) => set("itemName", event.target.value)}
          aria-invalid={Boolean(errors.itemName)}
          aria-describedby={errors.itemName ? `${idPrefix}-item-error` : undefined}
          required
        />
        <FieldError id={`${idPrefix}-item-error`}>{errors.itemName}</FieldError>
      </label>
      <label className="text-sm" htmlFor={`${idPrefix}-sku`}>
        SKU
        <input
          id={`${idPrefix}-sku`}
          className={control}
          value={draft.itemSku}
          onChange={(event) => set("itemSku", event.target.value)}
          aria-invalid={Boolean(errors.itemSku)}
          aria-describedby={errors.itemSku ? `${idPrefix}-sku-error` : undefined}
          required
        />
        <FieldError id={`${idPrefix}-sku-error`}>{errors.itemSku}</FieldError>
      </label>
      <label className="text-sm" htmlFor={`${idPrefix}-quantity`}>
        Quantity
        <input
          id={`${idPrefix}-quantity`}
          className={control}
          inputMode="numeric"
          value={draft.quantity}
          onChange={(event) => set("quantity", event.target.value)}
          aria-invalid={Boolean(errors.quantity)}
          aria-describedby={errors.quantity ? `${idPrefix}-quantity-error` : undefined}
          required
        />
        <FieldError id={`${idPrefix}-quantity-error`}>{errors.quantity}</FieldError>
      </label>
      <label className="text-sm" htmlFor={`${idPrefix}-reason`}>
        Reason
        <select
          id={`${idPrefix}-reason`}
          className={control}
          value={draft.reason}
          onChange={(event) => set("reason", event.target.value as RequestDraft["reason"])}
          aria-invalid={Boolean(errors.reason)}
          aria-describedby={errors.reason ? `${idPrefix}-reason-error` : undefined}
          required
        >
          <option value="">Choose a reason</option>
          {REASONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <FieldError id={`${idPrefix}-reason-error`}>{errors.reason}</FieldError>
      </label>
    </div>
  );
}

export function payloadFromDraft(draft: RequestDraft) {
  return {
    customerName: draft.customerName,
    customerEmail: draft.customerEmail,
    customerPhone: draft.customerPhone,
    orderReference: draft.orderReference,
    itemName: draft.itemName,
    itemSku: draft.itemSku,
    quantity: Number(draft.quantity),
    reason: draft.reason,
  };
}
