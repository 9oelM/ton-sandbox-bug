import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type ContractBConfig = {
    id: number;
    counter: number;
};

export function contractBConfigToCell(config: ContractBConfig): Cell {
    return beginCell().storeUint(config.id, 32).storeUint(config.counter, 32).endCell();
}

export const Opcodes = {
    increase: 0x7e8764ef,
};

export class ContractB implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new ContractB(address);
    }

    static createFromConfig(config: ContractBConfig, code: Cell, workchain = 0) {
        const data = contractBConfigToCell(config);
        const init = { code, data };
        return new ContractB(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendIncrease(
        provider: ContractProvider,
        via: Sender,
        opts: {
            increaseBy: number;
            value: bigint;
            queryID?: number;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.increase, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .storeUint(opts.increaseBy, 32)
                .endCell(),
        });
    }

    async getCounterAndTimestamp(provider: ContractProvider) {
        const result = await provider.get('get_counter', []);
        const counter = result.stack.readNumber();
        const timestamp = result.stack.readNumber();

        return { counter, timestamp };
    }

    async getID(provider: ContractProvider) {
        const result = await provider.get('get_id', []);
        return result.stack.readNumber();
    }

    async getBalance(provider: ContractProvider) {
        const result = await provider.getState()
        return result.balance;
    }

    async getTimestamp(provider: ContractProvider) {
        const result = await provider.get('get_timestamp', []);
        return result.stack.readNumber();
    }
}
