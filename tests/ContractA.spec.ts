import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, openContract, toNano } from '@ton/core';
import { ContractA } from '../wrappers/ContractA';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { ContractB } from '../wrappers/ContractB';
import { flattenTransaction } from '@ton/test-utils';

describe('ContractA', () => {
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

    it('fees test', async () => {
        const increaser = await blockchain.treasury('increaser');
        const contractBTONBalanceBefore = await contractB.getBalance();

        const increaseResult = await contractA.sendIncrease(increaser.getSender(), {
            increaseBy: 1,
            value: toNano('0.05'),
        });

        expect(increaseResult.transactions).toHaveTransaction({
            from: increaser.address,
            to: contractA.address,
            success: true,
        });
        expect(increaseResult.transactions).toHaveTransaction({
            from: contractA.address,
            to: contractB.address,
            success: true,
        });

        printTransactionFees(increaseResult.transactions);

        const allFees = increaseResult.transactions.reduce((acc, tx) => {
            return acc + tx.totalFees.coins;
        }, 0n)
        
        const contractBTONBalanceAfter = await contractB.getBalance();
        console.log('contractB TON inflow', contractBTONBalanceAfter - contractBTONBalanceBefore);

        const lastTx = flattenTransaction(increaseResult.transactions[increaseResult.transactions.length - 1]);
        expect(lastTx.value! - lastTx.totalFees!).toBe(
            toNano('0.05') - allFees
        );
    });
});
