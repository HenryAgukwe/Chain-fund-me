
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// =============================================================================
// COMMIT 1: CAMPAIGN CREATION TESTS
// Comprehensive test suite for campaign creation functionality
// =============================================================================

// Test constants matching contract constants
const CAMPAIGN_STATUS_ACTIVE = types.uint(0);
const CAMPAIGN_STATUS_SUCCESSFUL = types.uint(1);
const CAMPAIGN_STATUS_FAILED = types.uint(2);
const CAMPAIGN_STATUS_CANCELLED = types.uint(3);

// Error constants
const ERR_CAMPAIGN_NOT_FOUND = types.uint(100);
const ERR_CAMPAIGN_ALREADY_EXISTS = types.uint(101);
const ERR_CAMPAIGN_ENDED = types.uint(102);
const ERR_INSUFFICIENT_FUNDS = types.uint(103);
const ERR_INVALID_AMOUNT = types.uint(104);
const ERR_UNAUTHORIZED = types.uint(105);
const ERR_CAMPAIGN_NOT_ACTIVE = types.uint(106);
const ERR_GOAL_ALREADY_REACHED = types.uint(107);
const ERR_CAMPAIGN_ALREADY_CANCELLED = types.uint(108);
const ERR_REFUND_NOT_ALLOWED = types.uint(109);

// Campaign constants
const MIN_CAMPAIGN_DURATION = 1440; // blocks
const MAX_CAMPAIGN_DURATION = 43200; // blocks
const MIN_CONTRIBUTION = 1000000; // microSTX

Clarinet.test({
    name: "Test successful campaign creation with valid parameters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;

        const title = "Test Campaign";
        const description = "A test campaign for crowdfunding";
        const goal = types.uint(10000000); // 10 STX
        const duration = types.uint(2000); // blocks
        const category = "Technology";

        let block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii(title),
                    types.utf8(description),
                    goal,
                    duration,
                    types.ascii(category),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        
        const receipt = block.receipts[0];
        assertEquals(receipt.result.expectOk(), types.uint(1));
        
        // Test basic campaign information retrieval
        let statusCheck = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-status",
            [types.uint(1)],
            creator.address
        );
        assertEquals(statusCheck.result.expectOk(), CAMPAIGN_STATUS_ACTIVE);
        
        // Test campaign raised amount (should be 0 initially)
        let raisedCheck = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-raised",
            [types.uint(1)],
            creator.address
        );
        assertEquals(raisedCheck.result.expectOk(), types.uint(0));
        
        // Test platform statistics
        let totalCampaigns = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-total-campaigns",
            [],
            creator.address
        );
        assertEquals(totalCampaigns.result.expectOk(), types.uint(1));
    },
});

Clarinet.test({
    name: "Test campaign creation with invalid goal amount (zero)",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;

        const title = "Invalid Goal Campaign";
        const description = "Campaign with zero goal";
        const goal = types.uint(0); // Invalid: zero goal
        const duration = types.uint(2000);
        const category = "Technology";

        let block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii(title),
                    types.utf8(description),
                    goal,
                    duration,
                    types.ascii(category),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        const receipt = block.receipts[0];
        assertEquals(receipt.result.expectErr(), ERR_INVALID_AMOUNT);
    },
});

Clarinet.test({
    name: "Test campaign creation with duration too short",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;

        const title = "Short Duration Campaign";
        const description = "Campaign with too short duration";
        const goal = types.uint(5000000);
        const duration = types.uint(1000); // Less than MIN_CAMPAIGN_DURATION
        const category = "Technology";

        let block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii(title),
                    types.utf8(description),
                    goal,
                    duration,
                    types.ascii(category),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        const receipt = block.receipts[0];
        assertEquals(receipt.result.expectErr(), ERR_INVALID_AMOUNT);
    },
});

Clarinet.test({
    name: "Test campaign creation with duration too long",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;

        const title = "Long Duration Campaign";
        const description = "Campaign with too long duration";
        const goal = types.uint(5000000);
        const duration = types.uint(50000); // More than MAX_CAMPAIGN_DURATION
        const category = "Technology";

        let block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii(title),
                    types.utf8(description),
                    goal,
                    duration,
                    types.ascii(category),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        const receipt = block.receipts[0];
        assertEquals(receipt.result.expectErr(), ERR_INVALID_AMOUNT);
    },
});

Clarinet.test({
    name: "Test multiple campaign creation and counter increment",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator1 = accounts.get("wallet_1")!;
        const creator2 = accounts.get("wallet_2")!;
        const beneficiary1 = accounts.get("wallet_3")!;
        const beneficiary2 = accounts.get("wallet_4")!;

        // Create first campaign
        let block1 = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("First Campaign"),
                    types.utf8("First test campaign"),
                    types.uint(5000000),
                    types.uint(2000),
                    types.ascii("Technology"),
                    types.principal(beneficiary1.address)
                ],
                creator1.address
            )
        ]);

        assertEquals(block1.receipts.length, 1);
        assertEquals(block1.receipts[0].result.expectOk(), types.uint(1));

        // Create second campaign
        let block2 = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Second Campaign"),
                    types.utf8("Second test campaign"),
                    types.uint(8000000),
                    types.uint(3000),
                    types.ascii("Art"),
                    types.principal(beneficiary2.address)
                ],
                creator2.address
            )
        ]);

        assertEquals(block2.receipts.length, 1);
        assertEquals(block2.receipts[0].result.expectOk(), types.uint(2));

        // Verify total campaigns count
        let totalCampaigns = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-total-campaigns",
            [],
            creator1.address
        );
        assertEquals(totalCampaigns.result.expectOk(), types.uint(2));

        // Verify both campaigns have correct goals
        let goal1 = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-raised",
            [types.uint(1)],
            creator1.address
        );
        let goal2 = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-raised",
            [types.uint(2)],
            creator1.address
        );

        assertEquals(goal1.result.expectOk(), types.uint(0)); // Initially raised should be 0
        assertEquals(goal2.result.expectOk(), types.uint(0)); // Initially raised should be 0
    },
});

Clarinet.test({
    name: "Test campaign creation with edge case parameters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;

        // Test with minimum valid duration
        let block1 = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Min Duration Campaign"),
                    types.utf8("Campaign with minimum duration"),
                    types.uint(1000000),
                    types.uint(MIN_CAMPAIGN_DURATION), // Exactly minimum duration
                    types.ascii("Test"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(block1.receipts.length, 1);
        assertEquals(block1.receipts[0].result.expectOk(), types.uint(1));

        // Test with maximum valid duration
        let block2 = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Max Duration Campaign"),
                    types.utf8("Campaign with maximum duration"),
                    types.uint(1000000),
                    types.uint(MAX_CAMPAIGN_DURATION), // Exactly maximum duration
                    types.ascii("Test"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(block2.receipts.length, 1);
        assertEquals(block2.receipts[0].result.expectOk(), types.uint(2));
    },
});

Clarinet.test({
    name: "Test campaign creation with maximum string lengths",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;

        // Create strings at maximum allowed length
        const maxTitle = "A".repeat(100); // Max title length
        const maxDescription = "B".repeat(1000); // Max description length  
        const maxCategory = "C".repeat(50); // Max category length

        let block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii(maxTitle),
                    types.utf8(maxDescription),
                    types.uint(5000000),
                    types.uint(2000),
                    types.ascii(maxCategory),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.uint(1));
        
        // Verify campaign was created successfully by checking status
        let status = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-status",
            [types.uint(1)],
            creator.address
        );
        assertEquals(status.result.expectOk(), CAMPAIGN_STATUS_ACTIVE);
    },
});

Clarinet.test({
    name: "Test campaign initial state verification",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;

        // Create a campaign
        let block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("State Test Campaign"),
                    types.utf8("Testing initial state"),
                    types.uint(10000000),
                    types.uint(2000),
                    types.ascii("Technology"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        const campaignId = block.receipts[0].result.expectOk();

        // Test all read-only functions for initial state
        
        // Campaign status should be ACTIVE
        let status = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-status",
            [campaignId],
            creator.address
        );
        assertEquals(status.result.expectOk(), CAMPAIGN_STATUS_ACTIVE);

        // Raised amount should be zero
        let raised = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-raised",
            [campaignId],
            creator.address
        );
        assertEquals(raised.result.expectOk(), types.uint(0));

        // Contributors count should be zero
        let contributorsCount = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-contributors-count",
            [campaignId],
            creator.address
        );
        assertEquals(contributorsCount.result.expectOk(), types.uint(0));

        // Progress should be zero
        let progress = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-progress",
            [campaignId],
            creator.address
        );
        assertEquals(progress.result.expectOk(), types.uint(0));

        // Time remaining should be close to duration (allowing for block advancement)
        let timeRemaining = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-time-remaining",
            [campaignId],
            creator.address
        );
        // Since one block was mined for campaign creation, expect duration - 1
        assertEquals(timeRemaining.result.expectOk(), types.uint(1999));

        // Verification status should be false
        let verification = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-verification",
            [campaignId],
            creator.address
        );
        const verificationTuple: any = verification.result.expectOk().expectTuple();
        assertEquals(verificationTuple["is-verified"], types.bool(false));
    },
});

Clarinet.test({
    name: "Test platform statistics tracking",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;

        // Check initial platform stats
        let initialStats = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-platform-stats",
            [],
            creator.address
        );
        const initialStatsData: any = initialStats.result.expectOk().expectTuple();
        assertEquals(initialStatsData["total-campaigns"], types.uint(0));

        // Create a campaign
        let block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Stats Test Campaign"),
                    types.utf8("Testing platform statistics"),
                    types.uint(5000000),
                    types.uint(2000),
                    types.ascii("Technology"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.uint(1));

        // Check updated platform stats
        let updatedStats = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-platform-stats",
            [],
            creator.address
        );
        const updatedStatsData: any = updatedStats.result.expectOk().expectTuple();
        assertEquals(updatedStatsData["total-campaigns"], types.uint(1));
        assertEquals(updatedStatsData["total-raised"], types.uint(0)); // No contributions yet
    },
});

Clarinet.test({
    name: "Test getting campaign info for non-existent campaign",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;

        // Try to get info for non-existent campaign
        let campaignInfo = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-status",
            [types.uint(999)], // Non-existent campaign ID
            creator.address
        );
        
        // This should cause an error since campaign doesn't exist
        campaignInfo.result.expectErr();
    },
});
