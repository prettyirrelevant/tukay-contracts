// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.2;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {VRFConsumerBaseV2} from "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/FunctionsClient.sol";
import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/libraries/FunctionsRequest.sol";


contract Giveaway is VRFConsumerBaseV2, FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;
    using EnumerableMap for EnumerableMap.AddressToUintMap;

    address public admin;
    address internal constant ZERO_ADDRESS = address(0);

    mapping(uint256 => bool) private hasRequestedRandomWords;
    mapping(uint256 => bool) private hasMadeFunctionRequest;


    // Chainlink VRF configuration
    bytes32 internal keyHash;
    uint64 internal vrfSubscriptionId;
    uint64 internal functionSubscriptionId;
    bytes32 internal donId = 0x66756e2d6176616c616e6368652d66756a692d31000000000000000000000000;

    VRFCoordinatorV2Interface internal coordinator;

    // Regular giveaways.
    uint256 public regularGiveawayCounter = 0;
    struct RegularGiveaway {
        bytes32 name;
        uint256 endAt;
        address token;
        uint256 amount;
        uint256 startAt;
        address creator;
        bool hasWinners;
        uint256 maxWinners;
        uint256 maxParticipants;
    }
    struct RegularGiveawayWinner {
        bool hasWithdrawnFunds;
        bool isValid;
    }
    mapping(uint256 => RegularGiveaway) public regularGiveaways;
    mapping(uint256 => uint256) public requestIdsToRegularGiveaways;
    mapping(uint256 => EnumerableMap.AddressToUintMap) internal regularGiveawaysParticipants;
    mapping(uint256 => mapping(address => RegularGiveawayWinner)) internal regularGiveawaysWinners;

    event NewRegularGiveaway(
        uint256 indexed identifier,
        uint256 endAt,
        address token,
        uint256 amount,
        address creator,
        uint256 startAt,
        uint256 maxWinners,
        uint256 maxParticipants
    );

    event NewRegularGiveawayParticipant(
        uint256 indexed identifier,
        address participant
    );

    event NewRegularGiveawayWinner(
        uint256 indexed identifier,
        address participant
    );

    event RegularGiveawayWinnerPaid(uint256 indexed identifier, address winner, uint256 amount);

    // Trivia  Giveaway
    uint256 public triviaGiveawayCounter = 0;
    string internal source =
        "const giveawayId = args[0];"
        "const apiResponse = await Functions.makeHttpRequest({url: `https://tukay-server.fly.dev/api/giveaways/trivia/${giveawayId}/winners`});"
        "if (apiResponse.error) {"
        "  throw Error('Request failed');"
        "}"
        "const { data } = apiResponse;"
        "return Functions.encodeString(data.data);";

    struct TriviaGiveaway {
        bytes32 name;
        uint256 endAt;
        address token;
        uint256 amount;
        uint256 startAt;
        address creator;
        uint256 triviaType;
        bool hasWinners;
        uint256 maxWinners;
        uint256 maxParticipants;
    }
    struct TriviaGiveawayWinner {
        bool hasWithdrawnFunds;
        bool isValid;
    }
    mapping(uint256 => TriviaGiveaway) public triviaGiveaways;
    mapping(bytes32 => uint256) public requestIdsToTriviaGiveaways;
    mapping(uint256 => EnumerableMap.AddressToUintMap) internal triviaGiveawaysParticipants;
    mapping(uint256 => mapping(address => TriviaGiveawayWinner)) internal triviaGiveawaysWinners;


    event NewTriviaGiveaway(
        uint256 indexed identifier,
        uint256 endAt,
        address token,
        uint256 amount,
        address creator,
        uint256 startAt,
        uint256 triviaType,
        uint256 maxWinners,
        uint256 maxParticipants
    );

    event NewTriviaGiveawayParticipant(
        uint256 indexed identifier,
        string answers,
        uint256 triviaType,
        address participant
    );

    event NewTriviaGiveawayWinner(
        uint256 indexed identifier,
        address participant
    );

    event TriviaGiveawayWinnerPaid(uint256 indexed identifier, address winner, uint256 amount);

    constructor(
        uint64 vrfSubId,
        bytes32 _keyHash,
        uint64 funcSubId,
        address coordinatorAddress,
        address functionsRouterAddress
    ) VRFConsumerBaseV2(coordinatorAddress) FunctionsClient(functionsRouterAddress) {
        admin = msg.sender;
        keyHash = _keyHash;
        vrfSubscriptionId = vrfSubId;
        functionSubscriptionId = funcSubId;
        coordinator = VRFCoordinatorV2Interface(coordinatorAddress);
    }

    /**
     * @notice Creates a new regular giveaway.
     * @dev Emits a `NewRegularGiveaway` event upon successful creation.
     * @param _name The name of the giveaway (must not be empty).
     * @param _endAt The timestamp when the giveaway ends (must be in the future).
     * @param _token The address of the token to be given away (use ZERO_ADDRESS for Ether).
     * @param _amount The amount of tokens/ether to be given away.
     * @param _startAt The timestamp when the giveaway starts (must be less than `_endAt`).
     * @param _maxWinners The maximum number of winners (must be greater than 0 and less than or equal to 10).
     * @param _maxParticipants The maximum number of participants (must be greater than the number of winners).
     * @return The identifier of the newly created giveaway.
     */
    function createRegularGiveaway(
        bytes32 _name,
        uint256 _endAt,
        address _token,
        uint256 _amount,
        uint256 _startAt,
        uint256 _maxWinners,
        uint256 _maxParticipants
    ) public payable returns (uint256) {
        require(
            _maxWinners > 0 && _maxParticipants > 0,
            "participants and winners can never be 0"
        );
        require(_maxWinners <= 10, "you cannot have more than 10 winners");
        require(
            _maxParticipants > _maxWinners,
            "participants must always be greater than winners"
        );
        require(_startAt < _endAt, "giveaway cannot end before starting");
        require(
            _endAt > block.timestamp + 15 minutes,
            "giveaway must have a duration of at least 15 minutes"
        );
        require(_name != "", "giveaway name cannot be empty");

        if (_token == ZERO_ADDRESS) {
            require(
                msg.value == _amount,
                "Ether sent must be equal to the amount specified"
            );
        } else {
            IERC20 erc20Token = IERC20(_token);
            require(
                erc20Token.allowance(msg.sender, address(this)) >= _amount,
                "Insuficient allowance provided"
            );

            SafeERC20.safeTransferFrom(
                erc20Token,
                msg.sender,
                address(this),
                _amount
            );
        }

        regularGiveawayCounter += 1;
        uint256 amountAfterFivePercentCut = calculate95Percent(_amount);
        regularGiveaways[regularGiveawayCounter] = RegularGiveaway({
            name: _name,
            endAt: _endAt,
            token: _token,
            startAt: _startAt,
            hasWinners: false,
            creator: msg.sender,
            maxWinners: _maxWinners,
            amount: amountAfterFivePercentCut,
            maxParticipants: _maxParticipants
        });

        emit NewRegularGiveaway(
            regularGiveawayCounter,
            _endAt,
            _token,
            amountAfterFivePercentCut,
            msg.sender,
            _startAt,
            _maxWinners,
            _maxParticipants
        );
        return regularGiveawayCounter;
    }

    function participateInRegularGiveaway(uint256 giveawayId) public {
        RegularGiveaway memory giveaway = regularGiveaways[giveawayId];
        require(giveaway.amount != 0, "Giveaway does not exist");
        require(
            giveaway.creator != msg.sender,
            "Giveaway creator cannot participate"
        );
        require(giveaway.endAt > block.timestamp, "Giveaway has ended");
        require(
            !EnumerableMap.contains(
                regularGiveawaysParticipants[giveawayId],
                msg.sender
            ),
            "Already a participant for the giveaway"
        );
        require(
            EnumerableMap.length(regularGiveawaysParticipants[giveawayId]) <
                giveaway.maxParticipants,
            "Max participants for giveaway reached"
        );
        require(
            EnumerableMap.set(
                regularGiveawaysParticipants[giveawayId],
                msg.sender,
                1
            ),
            "Could not add participant to giveaway"
        );

        emit NewRegularGiveawayParticipant(giveawayId, msg.sender);
    }

    function pickRegularGiveawayWinners(uint256 giveawayId) public returns (uint256) {
        RegularGiveaway memory giveaway = regularGiveaways[giveawayId];
        require(giveaway.amount != 0, "Giveaway does not exist");
        require(block.timestamp > giveaway.endAt, "Giveaway has not ended");
        require(
            giveaway.hasWinners == false,
            "Giveaway winners have been selected"
        );
        require(
            hasRequestedRandomWords[giveawayId] != true,
            "Giveaway is currently selecting winners"
        );

        // request random indexes from VRF
        uint256 randomWordsToGenerate =
            EnumerableMap.length(regularGiveawaysParticipants[giveawayId]) <
                giveaway.maxWinners
                ? EnumerableMap.length(regularGiveawaysParticipants[giveawayId])
                : giveaway.maxWinners;

        uint256 requestId = coordinator.requestRandomWords(
            keyHash,
            vrfSubscriptionId,
            3,
            250000,
            SafeCast.toUint32(randomWordsToGenerate)
        );

        requestIdsToRegularGiveaways[requestId] = giveawayId;
        hasRequestedRandomWords[giveawayId] = true;

        return requestId;
    }

    function withdrawRegularGiveawayPrize(uint256 giveawayId) external {
        RegularGiveaway memory giveaway = regularGiveaways[giveawayId];
        require(giveaway.amount != 0, "Giveaway does not exist");
        require(block.timestamp > giveaway.endAt, "Giveaway has not ended");
        require(
            giveaway.hasWinners == true,
            "Giveaway winners have not been selected"
        );
        require(
            regularGiveawaysWinners[giveawayId][msg.sender].isValid,
            "Not a winner"
        );
        require(
            !regularGiveawaysWinners[giveawayId][msg.sender].hasWithdrawnFunds,
            "A withdrawal has been issued alredy"
        );

        uint256 winnersCount = EnumerableMap.length(
            regularGiveawaysParticipants[giveawayId]
        ) < giveaway.maxWinners
            ? EnumerableMap.length(regularGiveawaysParticipants[giveawayId])
            : giveaway.maxWinners;

        (bool success, uint256 prizeMoney) = Math.tryDiv(
            giveaway.amount,
            winnersCount
        );
        require(success, "Cannot pay out prize of giveaway");

        if (giveaway.token == ZERO_ADDRESS) {
            (bool isSuccess, ) = payable(msg.sender).call{value: prizeMoney}(
                ""
            );
            require(isSuccess, "Failed to send prize money");
            regularGiveawaysWinners[giveawayId][msg.sender]
                .hasWithdrawnFunds = true;
        } else {
            IERC20 erc20Token = IERC20(giveaway.token);
            SafeERC20.safeTransferFrom(
                erc20Token,
                address(this),
                msg.sender,
                prizeMoney
            );
            regularGiveawaysWinners[giveawayId][msg.sender]
                .hasWithdrawnFunds = true;
        }
        emit RegularGiveawayWinnerPaid(giveawayId, msg.sender, prizeMoney);
    }

    function createTriviaGiveaway(
        bytes32 _name,
        uint256 _endAt,
        address _token,
        uint256 _amount,
        uint256 _startAt,
        uint256 _maxWinners,
        uint256 _triviaType,
        uint256 _maxParticipants
    ) public payable returns (uint256) {
        require(
            _maxWinners > 0 && _maxParticipants > 0,
            "participants and winners can never be 0"
        );
        require(_maxWinners <= 10, "you cannot have more than 10 winners");
        require(
            _maxParticipants > _maxWinners,
            "participants must always be greater than winners"
        );
        require(_startAt < _endAt, "giveaway cannot end before starting");
        require(
            _endAt > block.timestamp + 15 minutes,
            "giveaway must have a duration of at least 15 minutes"
        );
        require(_name != "", "giveaway name cannot be empty");

        if (_token == ZERO_ADDRESS) {
            require(
                msg.value == _amount,
                "Ether sent must be equal to the amount specified"
            );
        } else {
            IERC20 erc20Token = IERC20(_token);
            require(
                erc20Token.allowance(msg.sender, address(this)) >= _amount,
                "Insuficient allowance provided"
            );

            SafeERC20.safeTransferFrom(
                erc20Token,
                msg.sender,
                address(this),
                _amount
            );
        }

        triviaGiveawayCounter += 1;
        uint256 amountAfterFivePercentCut = calculate95Percent(_amount);
        triviaGiveaways[triviaGiveawayCounter] = TriviaGiveaway({
            name: _name,
            endAt: _endAt,
            token: _token,
            startAt: _startAt,
            hasWinners: false,
            creator: msg.sender,
            maxWinners: _maxWinners,
            triviaType: _triviaType,
            amount: amountAfterFivePercentCut,
            maxParticipants: _maxParticipants
        });

        emit NewTriviaGiveaway(
            triviaGiveawayCounter,
            _endAt,
            _token,
            amountAfterFivePercentCut,
            msg.sender,
            _startAt,
            _triviaType,
            _maxWinners,
            _maxParticipants
        );

        return triviaGiveawayCounter;
    }

    function participateInTriviaGiveaway(uint256 giveawayId, string calldata _answers) public {
        TriviaGiveaway memory giveaway = triviaGiveaways[giveawayId];
        require(giveaway.amount != 0, "Giveaway does not exist");
        require(
            giveaway.creator != msg.sender,
            "Giveaway creator cannot participate"
        );
        require(giveaway.endAt > block.timestamp, "Giveaway has ended");
        require(
            !EnumerableMap.contains(
                triviaGiveawaysParticipants[giveawayId],
                msg.sender
            ),
            "Already a participant for the giveaway"
        );
        require(
            EnumerableMap.length(triviaGiveawaysParticipants[giveawayId]) <
                giveaway.maxParticipants,
            "Max participants for giveaway reached"
        );
        require(
            EnumerableMap.set(
                triviaGiveawaysParticipants[giveawayId],
                msg.sender,
                1
            ),
            "Could not add participant to giveaway"
        );

        emit NewTriviaGiveawayParticipant(giveawayId, _answers, giveaway.triviaType, msg.sender);
    }

    function pickTriviaGiveawayWinners(uint256 giveawayId) public returns (uint256) {
        TriviaGiveawayGiveaway memory giveaway = triviaGiveaways[giveawayId];
        require(giveaway.amount != 0, "Giveaway does not exist");
        require(block.timestamp > giveaway.endAt, "Giveaway has not ended");
        require(
            giveaway.hasWinners == false,
            "Giveaway winners have been selected"
        );
        require(
            hasMadeFunctionRequest[giveawayId] != true,
            "Giveaway is currently selecting winners"
        );
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        req.setArgs([string(uint256)]);
        uint256 funReqId = _sendRequest(
            req.encodeCBOR(),
            functionSubscriptionId,
            250000,
            donId
        );

        requestIdsToTriviaGiveaways[requestId] = giveawayId;
        hasMadeFunctionRequest[giveawayId] = true;

        return requestId;
    }

    function withdrawTriviaGiveawayPrize(uint256 giveawayId) external {
        TriviaGiveaway memory giveaway = triviaGiveaways[giveawayId];
        require(giveaway.amount != 0, "Giveaway does not exist");
        require(block.timestamp > giveaway.endAt, "Giveaway has not ended");
        require(
            giveaway.hasWinners == true,
            "Giveaway winners have not been selected"
        );
        require(
            triviaGiveawaysWinners[giveawayId][msg.sender].isValid,
            "Not a winner"
        );
        require(
            !triviaGiveawaysWinners[giveawayId][msg.sender].hasWithdrawnFunds,
            "A withdrawal has been issued alredy"
        );

        uint256 winnersCount = EnumerableMap.length(
            triviaGiveawaysParticipants[giveawayId]
        ) < giveaway.maxWinners
            ? EnumerableMap.length(triviaGiveawaysParticipants[giveawayId])
            : giveaway.maxWinners;

        (bool success, uint256 prizeMoney) = Math.tryDiv(
            giveaway.amount,
            winnersCount
        );
        require(success, "Cannot pay out prize of giveaway");

        if (giveaway.token == ZERO_ADDRESS) {
            (bool isSuccess, ) = payable(msg.sender).call{value: prizeMoney}(
                ""
            );
            require(isSuccess, "Failed to send prize money");
            triviaGiveawaysWinners[giveawayId][msg.sender]
                .hasWithdrawnFunds = true;
        } else {
            IERC20 erc20Token = IERC20(giveaway.token);
            SafeERC20.safeTransferFrom(
                erc20Token,
                address(this),
                msg.sender,
                prizeMoney
            );
            triviaGiveawaysWinners[giveawayId][msg.sender]
                .hasWithdrawnFunds = true;
        }
        emit TriviaGiveawayWinnerPaid(giveawayId, msg.sender, prizeMoney);
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        uint256 giveawayId = requestIdsToRegularGiveaways[requestId];
        require(giveawayId != 0, "request not found");

        RegularGiveaway storage giveaway = regularGiveaways[giveawayId];
        require(giveaway.amount != 0, "Giveaway not found");

        uint256 maxNumber = EnumerableMap.length(
            regularGiveawaysParticipants[giveawayId]
        ) < giveaway.maxWinners
            ? EnumerableMap.length(regularGiveawaysParticipants[giveawayId])
            : giveaway.maxWinners;

        for (uint256 i = 0; i < randomWords.length; i++) {
            (bool success, uint256 index) = Math.tryMod(
                randomWords[i],
                maxNumber
            );
            require(success, "Error picking winner for regular giveaway");

            (address participant, ) = EnumerableMap.at(
                regularGiveawaysParticipants[giveawayId],
                index
            );
            regularGiveawaysWinners[giveawayId][
                participant
            ] = RegularGiveawayWinner({
                isValid: true,
                hasWithdrawnFunds: false
            });

            emit NewRegularGiveawayWinner(giveawayId, participant);
        }

        giveaway.hasWinners = true;
    }

    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
        uint256 giveawayId = requestIdsToTriviaGiveaways[requestId];
        require(giveawayId != 0, "request not found");

        TriviaGiveaway storage giveaway = triviaGiveaways[giveawayId];
        require(giveaway.amount != 0, "Giveaway not found");

        // parse the string into addresses.
    }

    function calculate95Percent(uint256 value) public pure returns (uint256) {
        (bool success, uint256 result) = Math.tryDiv(value, 100);
        require(success, "Division overflowed");

        (success, result) = Math.tryMul(result, 95);
        require(success, "Multiplication underflowed");

        return result;
    }
}
