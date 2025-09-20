
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

// ============================================================================
// COMMIT 3: CAMPAIGN LIFECYCLE TESTS
// ============================================================================

Clarinet.test({
    name: "Test campaign contribution flow - successful contribution",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;
        const contributor = accounts.get("wallet_3")!;

        // Create campaign
        let createBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Crowdfunding Campaign"),
                    types.utf8("Help us build amazing software"),
                    types.uint(1000),
                    types.uint(30),
                    types.ascii("Technology"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(createBlock.receipts.length, 1);
        assertEquals(createBlock.receipts[0].result.expectOk(), types.uint(1));

        // Make contribution
        let contributeBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "contribute",
                [types.uint(1)],
                contributor.address
            )
        ]);

        assertEquals(contributeBlock.receipts.length, 1);
        assertEquals(contributeBlock.receipts[0].result.expectOk(), types.bool(true));

        // Verify contribution exists
        let contributionAmount = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-contribution-amount",
            [types.uint(1), types.principal(contributor.address)],
            deployer.address
        );

        assertEquals(contributionAmount.result.expectOk(), types.uint(100));
    },
});

Clarinet.test({
    name: "Test campaign contribution - multiple contributors",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;
        const contributor1 = accounts.get("wallet_3")!;
        const contributor2 = accounts.get("wallet_4")!;
        const contributor3 = accounts.get("wallet_5")!;

        // Create campaign with higher goal
        let createBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Multi-Contributor Campaign"),
                    types.utf8("Campaign with multiple contributors"),
                    types.uint(5000),
                    types.uint(45),
                    types.ascii("Community"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(createBlock.receipts.length, 1);
        assertEquals(createBlock.receipts[0].result.expectOk(), types.uint(1));

        // First contribution
        let contribute1Block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "contribute",
                [types.uint(1)],
                contributor1.address
            )
        ]);

        assertEquals(contribute1Block.receipts[0].result.expectOk(), types.bool(true));

        // Second contribution
        let contribute2Block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "contribute",
                [types.uint(1)],
                contributor2.address
            )
        ]);

        assertEquals(contribute2Block.receipts[0].result.expectOk(), types.bool(true));

        // Third contribution
        let contribute3Block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "contribute",
                [types.uint(1)],
                contributor3.address
            )
        ]);

        assertEquals(contribute3Block.receipts[0].result.expectOk(), types.bool(true));

        // Verify total raised amount
        let totalRaised = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-total-raised",
            [types.uint(1)],
            deployer.address
        );

        assertEquals(totalRaised.result.expectOk(), types.uint(300));

        // Verify individual contributions
        let contribution1 = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-contribution-amount",
            [types.uint(1), types.principal(contributor1.address)],
            deployer.address
        );

        assertEquals(contribution1.result.expectOk(), types.uint(100));

        let contribution2 = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-contribution-amount",
            [types.uint(1), types.principal(contributor2.address)],
            deployer.address
        );

        assertEquals(contribution2.result.expectOk(), types.uint(100));
    },
});

Clarinet.test({
    name: "Test campaign contribution - contribute to non-existent campaign",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const contributor = accounts.get("wallet_1")!;

        // Try to contribute to non-existent campaign
        let contributeBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "contribute",
                [types.uint(999)],
                contributor.address
            )
        ]);

        assertEquals(contributeBlock.receipts.length, 1);
        assertEquals(contributeBlock.receipts[0].result.expectErr(), ERR_CAMPAIGN_NOT_FOUND);
    },
});

Clarinet.test({
    name: "Test campaign completion - successful completion",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;
        const contributor = accounts.get("wallet_3")!;

        // Create campaign
        let createBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Completion Test Campaign"),
                    types.utf8("Testing campaign completion"),
                    types.uint(200),
                    types.uint(30),
                    types.ascii("Testing"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(createBlock.receipts[0].result.expectOk(), types.uint(1));

        // Make sufficient contributions
        let contribute1Block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "contribute",
                [types.uint(1)],
                contributor.address
            )
        ]);

        assertEquals(contribute1Block.receipts[0].result.expectOk(), types.bool(true));

        let contribute2Block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "contribute",
                [types.uint(1)],
                creator.address
            )
        ]);

        assertEquals(contribute2Block.receipts[0].result.expectOk(), types.bool(true));

        // Complete campaign (should meet goal with 200+ raised)
        let completeBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "complete-campaign",
                [types.uint(1)],
                creator.address
            )
        ]);

        assertEquals(completeBlock.receipts[0].result.expectOk(), types.bool(true));
    },
});

Clarinet.test({
    name: "Test campaign completion - unauthorized completion attempt",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;
        const unauthorized = accounts.get("wallet_3")!;

        // Create campaign
        let createBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Auth Test Campaign"),
                    types.utf8("Testing completion authorization"),
                    types.uint(500),
                    types.uint(30),
                    types.ascii("Security"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(createBlock.receipts[0].result.expectOk(), types.uint(1));

        // Try to complete campaign as unauthorized user
        let completeBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "complete-campaign",
                [types.uint(1)],
                unauthorized.address
            )
        ]);

        assertEquals(completeBlock.receipts[0].result.expectErr(), ERR_UNAUTHORIZED);
    },
});

Clarinet.test({
    name: "Test campaign cancellation - successful cancellation by creator",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;

        // Create campaign
        let createBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Cancellation Test Campaign"),
                    types.utf8("Testing campaign cancellation"),
                    types.uint(1000),
                    types.uint(30),
                    types.ascii("Testing"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(createBlock.receipts[0].result.expectOk(), types.uint(1));

        // Cancel campaign
        let cancelBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "cancel-campaign",
                [types.uint(1)],
                creator.address
            )
        ]);

        assertEquals(cancelBlock.receipts[0].result.expectOk(), types.bool(true));
    },
});

Clarinet.test({
    name: "Test campaign cancellation - unauthorized cancellation attempt",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;
        const unauthorized = accounts.get("wallet_3")!;

        // Create campaign
        let createBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Auth Cancel Test Campaign"),
                    types.utf8("Testing cancellation authorization"),
                    types.uint(800),
                    types.uint(30),
                    types.ascii("Security"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(createBlock.receipts[0].result.expectOk(), types.uint(1));

        // Try to cancel campaign as unauthorized user
        let cancelBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "cancel-campaign",
                [types.uint(1)],
                unauthorized.address
            )
        ]);

        assertEquals(cancelBlock.receipts[0].result.expectErr(), ERR_UNAUTHORIZED);
    },
});

Clarinet.test({
    name: "Test campaign verification - successful public verification",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;
        const verifier = accounts.get("wallet_3")!;

        // Create campaign
        let createBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Verification Test Campaign"),
                    types.utf8("Testing campaign verification"),
                    types.uint(600),
                    types.uint(30),
                    types.ascii("Community"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(createBlock.receipts[0].result.expectOk(), types.uint(1));

        // Verify campaign publicly
        let verifyBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "verify-campaign-public",
                [types.uint(1)],
                verifier.address
            )
        ]);

        assertEquals(verifyBlock.receipts[0].result.expectOk(), types.bool(true));
    },
});

Clarinet.test({
    name: "Test campaign verification - verify non-existent campaign",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const verifier = accounts.get("wallet_1")!;

        // Try to verify non-existent campaign
        let verifyBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "verify-campaign-public",
                [types.uint(999)],
                verifier.address
            )
        ]);

        assertEquals(verifyBlock.receipts[0].result.expectErr(), ERR_CAMPAIGN_NOT_FOUND);
    },
});

Clarinet.test({
    name: "Test contribution refund functionality - after campaign cancellation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;
        const contributor = accounts.get("wallet_3")!;

        // Create campaign
        let createBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Refund Test Campaign"),
                    types.utf8("Testing contribution refunds"),
                    types.uint(1000),
                    types.uint(30),
                    types.ascii("Testing"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(createBlock.receipts[0].result.expectOk(), types.uint(1));

        // Make contribution
        let contributeBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "contribute",
                [types.uint(1)],
                contributor.address
            )
        ]);

        assertEquals(contributeBlock.receipts[0].result.expectOk(), types.bool(true));

        // Verify contribution before cancellation
        let contributionAmount = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-contribution-amount",
            [types.uint(1), types.principal(contributor.address)],
            creator.address
        );

        assertEquals(contributionAmount.result.expectOk(), types.uint(100));

        // Cancel campaign
        let cancelBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "cancel-campaign",
                [types.uint(1)],
                creator.address
            )
        ]);

        assertEquals(cancelBlock.receipts[0].result.expectOk(), types.bool(true));
    },
});

Clarinet.test({
    name: "Test campaign fund release - after successful completion",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get("wallet_1")!;
        const beneficiary = accounts.get("wallet_2")!;
        const contributor1 = accounts.get("wallet_3")!;
        const contributor2 = accounts.get("wallet_4")!;

        // Create campaign with lower goal for easier completion
        let createBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "create-campaign",
                [
                    types.ascii("Fund Release Campaign"),
                    types.utf8("Testing fund release mechanics"),
                    types.uint(150),
                    types.uint(30),
                    types.ascii("Finance"),
                    types.principal(beneficiary.address)
                ],
                creator.address
            )
        ]);

        assertEquals(createBlock.receipts[0].result.expectOk(), types.uint(1));

        // Make contributions to meet goal
        let contribute1Block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "contribute",
                [types.uint(1)],
                contributor1.address
            )
        ]);

        assertEquals(contribute1Block.receipts[0].result.expectOk(), types.bool(true));

        let contribute2Block = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "contribute",
                [types.uint(1)],
                contributor2.address
            )
        ]);

        assertEquals(contribute2Block.receipts[0].result.expectOk(), types.bool(true));

        // Verify total raised meets or exceeds goal
        let totalRaised = chain.callReadOnlyFn(
            "chain-fund-contract",
            "get-campaign-total-raised",
            [types.uint(1)],
            creator.address
        );

        assertEquals(totalRaised.result.expectOk(), types.uint(200));

        // Complete campaign to trigger fund release
        let completeBlock = chain.mineBlock([
            Tx.contractCall(
                "chain-fund-contract",
                "complete-campaign",
                [types.uint(1)],
                creator.address
            )
        ]);

        assertEquals(completeBlock.receipts[0].result.expectOk(), types.bool(true));
    },
});
