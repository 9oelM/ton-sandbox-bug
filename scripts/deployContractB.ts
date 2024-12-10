import { toNano } from '@ton/core';
import { ContractB } from '../wrappers/ContractB';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const contractB = provider.open(
        ContractB.createFromConfig(
            {
                id: Math.floor(Math.random() * 10000),
                counter: 0,
            },
            await compile('ContractB')
        )
    );

    await contractB.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(contractB.address);

    console.log('ID', await contractB.getID());
}
