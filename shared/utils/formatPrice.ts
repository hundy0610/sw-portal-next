export default function formatPrice(price: number): string {
  const temp = price.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");

  return `${temp}원`;
}
