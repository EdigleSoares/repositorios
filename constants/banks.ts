export type BankOption = {
  id: string;
  name: string;
  monogram: string;
  color: string;
  textColor?: string;
  packageNames: string[];
};

export type BankSelectionOption = Omit<BankOption, 'packageNames'> & {
  packageName: string;
};

export const ALL_BANKS_ID = 'ALL';

export const banks: BankOption[] = [
  { id: ALL_BANKS_ID, name: 'Todos os bancos', monogram: '★', color: '#00A844', packageNames: [] },
  { id: 'nubank', name: 'Nubank', monogram: 'nu', color: '#8A05BE', packageNames: ['com.nu.production'] },
  { id: 'itau', name: 'Itaú', monogram: 'itaú', color: '#EC7000', packageNames: ['com.itau', 'com.itau.personnalite'] },
  { id: 'bradesco', name: 'Bradesco', monogram: 'b', color: '#CC092F', packageNames: ['com.bradesco', 'br.com.bradesco.next'] },
  { id: 'bb', name: 'Banco do Brasil', monogram: 'bb', color: '#F8D117', textColor: '#173D80', packageNames: ['br.com.bb.android'] },
  { id: 'mercado-pago', name: 'Mercado Pago', monogram: 'mp', color: '#009EE3', packageNames: ['com.mercadopago.wallet'] },
  { id: 'caixa', name: 'Caixa', monogram: 'cx', color: '#0066B3', packageNames: ['br.gov.caixa.tem', 'br.com.gft.caixa'] },
  { id: 'inter', name: 'Inter', monogram: 'in', color: '#FF7A00', packageNames: ['br.com.intermedium'] },
  { id: 'pagbank', name: 'PagBank', monogram: 'p', color: '#13A867', packageNames: ['br.com.uol.ps'] },
  { id: 'c6', name: 'C6 Bank', monogram: 'c6', color: '#222222', packageNames: ['com.c6bank.app'] },
  { id: 'bmg', name: 'Banco BMG', monogram: 'bmg', color: '#F58220', packageNames: ['com.bmg.banco.mobile'] },
  { id: 'picpay', name: 'PicPay', monogram: 'pp', color: '#21C25E', packageNames: ['com.picpay'] },
  { id: 'santander', name: 'Santander', monogram: 's', color: '#EC0000', packageNames: ['com.santander.app'] },
  { id: 'neon', name: 'Neon', monogram: 'n', color: '#00AEEF', packageNames: ['com.neon'] },
  { id: 'stone', name: 'Ton / Stone', monogram: 'ton', color: '#00A859', packageNames: ['br.com.stone.ton', 'co.stone.pos.android'] },
];

export const SUPPORTED_BANK_PACKAGES = new Set(
  banks.flatMap((bank) => bank.packageNames),
);

export const bankSelectionOptions: BankSelectionOption[] = [
  {
    id: ALL_BANKS_ID,
    name: 'Todos os bancos',
    monogram: '★',
    color: '#00A844',
    packageName: ALL_BANKS_ID,
  },
  ...banks.flatMap((bank) =>
    bank.packageNames.map((packageName, index) => ({
      id: packageName,
      name:
        bank.id === 'bradesco' && index === 1
          ? 'Next'
          : bank.id === 'itau' && index === 1
            ? 'Itaú Personnalité'
            : bank.id === 'stone'
              ? index === 0
                ? 'Ton'
                : 'Stone'
              : bank.name,
      monogram: bank.monogram,
      color: bank.color,
      ...(bank.textColor ? { textColor: bank.textColor } : {}),
      packageName,
    })),
  ),
];

export function isBankSelectionId(value: string): boolean {
  return value === ALL_BANKS_ID || SUPPORTED_BANK_PACKAGES.has(value);
}

export function getBankForPackage(packageName: string): BankOption | undefined {
  return banks.find((bank) => bank.packageNames.includes(packageName));
}
