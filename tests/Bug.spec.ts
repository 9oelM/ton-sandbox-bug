import { Blockchain, internal, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, openContract, toNano } from '@ton/core';
import { ContractA, Opcodes } from '../wrappers/ContractA';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { ContractB } from '../wrappers/ContractB';
import { executeTill, flattenTransaction } from '@ton/test-utils';

describe('Bug', () => {
    let contractACode: Cell;
    let contractBCode: Cell;

    beforeAll(async () => {
        contractACode = await compile('ContractA');
        contractBCode = await compile('ContractB');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let contractA: SandboxContract<ContractA>;
    let contractB: SandboxContract<ContractB>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        contractB = blockchain.openContract(
            ContractB.createFromConfig(
                {
                    id: 0,
                    counter: 0,
                },
                contractBCode
            )
        );
        contractA = blockchain.openContract(
            ContractA.createFromConfig(
                {
                    id: 1,
                    counter: 0,
                    next_contract_address: contractB.address,
                },
                contractACode
            )
        );

        deployer = await blockchain.treasury('deployer');

        const deployResult1 = await contractA.sendDeploy(deployer.getSender(), toNano('0.05'));
        const deployResult2 = await contractB.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult1.transactions).toHaveTransaction({
            from: deployer.address,
            to: contractA.address,
            deploy: true,
            success: true,
        });
        expect(deployResult2.transactions).toHaveTransaction({
            from: deployer.address,
            to: contractB.address,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and contractA are ready to use
    });

    it('time test', async () => {
        const increaser = await blockchain.treasury('increaser');
        blockchain.now = Math.floor(Date.now() / 1000);
        console.log(blockchain.lt)

        const messages = await blockchain.sendMessageIter(
            internal({
                from: increaser.address,
                to: contractA.address,
                value: toNano(`0.5`),
                body: beginCell()
                    .storeUint(Opcodes.increase, 32)
                    .storeUint(0, 64)
                    .storeUint(1, 32)
                .endCell(),
            }),
            {
                now: blockchain.now,
            }
        );

        console.log({
            step: 0,
            from_contract_a: await contractA.getCounterAndTimestamp(),
            from_contract_b: await contractB.getCounterAndTimestamp(),
            blockchain_now: blockchain.now,
        })

        blockchain.now += 1000;

        console.log({
            step: 1,
            from_contract_a: await contractA.getCounterAndTimestamp(),
            from_contract_b: await contractB.getCounterAndTimestamp(),
            blockchain_now: blockchain.now,
        })

        await executeTill(messages, {
            from: increaser.address,
            to: contractA.address,
            success: true,
            // @ts-ignore
        }, { now: blockchain.now });

        blockchain.now += 1000;

        console.log({
            step: 2,
            from_contract_a: await contractA.getCounterAndTimestamp(),
            from_contract_b: await contractB.getCounterAndTimestamp(),
            blockchain_now: blockchain.now,
        })

        const end = await executeTill(messages, {
            from: contractA.address,
            to: contractB.address,
            success: true,
            // @ts-ignore
        }, { now: blockchain.now });

        console.log({
            step: 3,
            from_contract_a: await contractA.getCounterAndTimestamp(),
            from_contract_b: await contractB.getCounterAndTimestamp(),
            blockchain_now: blockchain.now,
        })


        expect(end).toHaveLength(1)
        expect(end[0].outMessagesCount).toBe(0)
        expect((await messages.next()).done).toBe(true);
    });
});
