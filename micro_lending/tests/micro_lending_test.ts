import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const CONTRACT_NAME = 'microlending';

Clarinet.test({
    name: "Ensure contract owner can add and remove collateral assets",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const asset = "STX";

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'add-collateral-asset',
                [types.ascii(asset)],
                deployer.address
            )
        ]);

        assertEquals(block.receipts[0].result, '(ok true)');

        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'remove-collateral-asset',
                [types.ascii(asset)],
                deployer.address
            )
        ]);

        assertEquals(block.receipts[0].result, '(ok true)');
    },
});

Clarinet.test({
    name: "Ensure non-owner cannot add collateral assets",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const user = accounts.get('wallet_1')!;
        const asset = "STX";

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'add-collateral-asset',
                [types.ascii(asset)],
                user.address
            )
        ]);

        assertEquals(block.receipts[0].result, `(err u1000)`); // ERR-NOT-AUTHORIZED
    },
});

Clarinet.test({
    name: "Ensure loan creation works with valid parameters",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const borrower = accounts.get('wallet_1')!;
        const asset = "STX";

        // First add collateral asset
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'add-collateral-asset',
                [types.ascii(asset)],
                deployer.address
            ),
            // Update price feed
            Tx.contractCall(
                CONTRACT_NAME,
                'update-asset-price',
                [types.ascii(asset), types.uint(1000000)],
                deployer.address
            ),
            // Create loan request
            Tx.contractCall(
                CONTRACT_NAME,
                'create-loan-request',
                [
                    types.uint(1000000), // amount
                    types.uint(2000000), // collateral (200%)
                    types.ascii(asset),
                    types.uint(1440), // duration (1 day)
                    types.uint(500) // 5% interest rate
                ],
                borrower.address
            )
        ]);

        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.receipts[1].result, '(ok true)');
        assertEquals(block.receipts[2].result, '(ok u1)');
    },
});

Clarinet.test({
    name: "Ensure loan creation fails with insufficient collateral",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const borrower = accounts.get('wallet_1')!;
        const asset = "STX";

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'add-collateral-asset',
                [types.ascii(asset)],
                deployer.address
            ),
            Tx.contractCall(
                CONTRACT_NAME,
                'update-asset-price',
                [types.ascii(asset), types.uint(1000000)],
                deployer.address
            ),
            // Try to create loan with insufficient collateral
            Tx.contractCall(
                CONTRACT_NAME,
                'create-loan-request',
                [
                    types.uint(1000000), // amount
                    types.uint(1000000), // collateral (100% - insufficient)
                    types.ascii(asset),
                    types.uint(1440),
                    types.uint(500)
                ],
                borrower.address
            )
        ]);

        assertEquals(block.receipts[2].result, `(err u1002)`); // ERR-INSUFFICIENT-COLLATERAL
    },
});

Clarinet.test({
    name: "Ensure liquidation works when conditions are met",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const borrower = accounts.get('wallet_1')!;
        const liquidator = accounts.get('wallet_2')!;
        const asset = "STX";

        // Setup loan
        let block = chain.mineBlock([
            // Add collateral asset
            Tx.contractCall(
                CONTRACT_NAME,
                'add-collateral-asset',
                [types.ascii(asset)],
                deployer.address
            ),
            // Set initial price
            Tx.contractCall(
                CONTRACT_NAME,
                'update-asset-price',
                [types.ascii(asset), types.uint(1000000)],
                deployer.address
            ),
            // Create loan request
            Tx.contractCall(
                CONTRACT_NAME,
                'create-loan-request',
                [
                    types.uint(1000000),
                    types.uint(2000000),
                    types.ascii(asset),
                    types.uint(1440),
                    types.uint(500)
                ],
                borrower.address
            ),
            // Activate the loan
            Tx.contractCall(
                CONTRACT_NAME,
                'activate-loan',
                [types.uint(1)],
                deployer.address
            )
        ]);

        // Simulate time passing and price drop
        chain.mineEmptyBlockUntil(chain.blockHeight + 1441); // Pass loan duration

        // Update price to trigger liquidation
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'update-asset-price',
                [types.ascii(asset), types.uint(500000)], // 50% price drop
                deployer.address
            ),
            Tx.contractCall(
                CONTRACT_NAME,
                'liquidate-loan',
                [types.uint(1)],
                liquidator.address
            )
        ]);

        assertEquals(block.receipts[1].result, '(ok true)');
    },
});

Clarinet.test({
    name: "Ensure emergency stop mechanism works",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const borrower = accounts.get('wallet_1')!;
        const asset = "STX";

        let block = chain.mineBlock([
            // First add collateral asset and set price
            Tx.contractCall(
                CONTRACT_NAME,
                'add-collateral-asset',
                [types.ascii(asset)],
                deployer.address
            ),
            Tx.contractCall(
                CONTRACT_NAME,
                'update-asset-price',
                [types.ascii(asset), types.uint(1000000)],
                deployer.address
            ),
            // Enable emergency stop
            Tx.contractCall(
                CONTRACT_NAME,
                'toggle-emergency-stop',
                [],
                deployer.address
            ),
            // Try to create loan during emergency stop
            Tx.contractCall(
                CONTRACT_NAME,
                'create-loan-request',
                [
                    types.uint(1000000),
                    types.uint(2000000),
                    types.ascii(asset),
                    types.uint(1440),
                    types.uint(500)
                ],
                borrower.address
            )
        ]);

        assertEquals(block.receipts[2].result, '(ok true)'); // toggle-emergency-stop
        assertEquals(block.receipts[3].result, `(err u1011)`); // ERR-EMERGENCY-STOP
    },
});