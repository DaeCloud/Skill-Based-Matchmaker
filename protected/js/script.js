$(document).ready(function () {
    let playersTakingPart = [];
    // Fetch all players
    $.get('/api/players', function(players) {
        // Fetch skill levels for each player
        const skillRequests = players.map(player => {
            return $.get(`/api/skill/${player.id}`).then(skill => {
                return {
                    ...player,
                    skillLevel: skill.skillLevel
                };
            });
        });

        // Wait for all skill level requests to complete
        Promise.all(skillRequests).then(playersWithSkills => {
            // Sort players by skill level (descending)
            playersWithSkills.sort((a, b) => b.skillLevel - a.skillLevel);

            // Populate the rankings table
            const rankingsTableBody = $('#rankings tbody');
            rankingsTableBody.empty();
            playersWithSkills.forEach((player, index) => {
                const row = `<tr>
                    <th scope="row">${index + 1}</th>
                    <td>${player.username}</td>
                    <td>${player.firstName} ${player.lastName}</td>
                    <td>${player.skillLevel.toFixed(2) || 0}</td>
                    <td><input type="checkbox" class="isPlaying" data-player-id="${player.id}" /></td>
                </tr>`;
                rankingsTableBody.append(row);
            });

            $(".isPlaying").on("change", e => {
                let playerId = $(e.currentTarget).data("player-id");
                let value = e.currentTarget.checked;
                
                if (value) {
                    playersTakingPart.push(playerId);
                } else {
                    const index = playersTakingPart.indexOf(playerId);

                    if (index !== -1) {
                        playersTakingPart.splice(index, 1);
                    }
                }

                generateTeams();
            })
        });
    });

    // Show the modal when the "Add Player" button is clicked
    $('#addPlayer').click(function() {
        $('#addPlayerModal').modal('show');
    });

    // Submit form handler
    $('#addPlayerForm').submit(function(event) {
        event.preventDefault(); // Prevent the form from submitting normally

        // Get form data
        const formData = {
            firstName: $('#firstName').val(),
            lastName: $('#lastName').val(),
            username: $('#username').val()
        };

        // Send the form data to the server to add a new player
        $.ajax({
            type: 'POST',
            url: '/api/players',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(response) {
                console.log('Player added successfully:', response);
                // Close the modal
                $('#addPlayerModal').modal('hide');
                // Clear form fields
                $('#addPlayerForm')[0].reset();
                // Refresh the page to update player rankings (you may implement a more efficient way to update the UI)
                location.reload();
            },
            error: function(xhr, status, error) {
                console.error('Error adding player:', error);
                // Handle error (e.g., display an error message to the user)
            }
        });
    });

    // Show the modal when the "Add Score" button is clicked
    $('#addScore').click(function () {
        fetchUsernamesAndPopulateDropdown();
        $('#addScoreModal').modal('show');
    });

    // Function to fetch usernames and populate dropdown
    function fetchUsernamesAndPopulateDropdown() {
        $.get('/api/players', function(players) {
            const dropdown = $('#playerIdScore');
            players.sort((a, b) => a.username.toLowerCase().localeCompare(b.username.toLowerCase()));
            dropdown.empty(); // Clear existing options
            dropdown.append($('<option>').attr('value', '').text('Select a player')); // Add default option
            players.forEach(function (player) {
                dropdown.append($('<option>').attr('value', player.id).text(player.username)); // Add player username as option
            });
        });
    }

    // Submit form handler
    $('#addScoreForm').submit(function(event) {
        event.preventDefault(); // Prevent the form from submitting normally

        // Get form data
        const formData = {
            value: $('#value').val()
        };

        let playerId = $("#playerIdScore").val();

        // Send the form data to the server to add a new score
        $.ajax({
            type: 'POST',
            url: `/api/scores/${playerId}`,
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(response) {
                console.log('Score added successfully:', response);
                // Close the modal
                $('#addScoreModal').modal('hide');
                // Clear form fields
                $('#addScoreForm')[0].reset();

                location.reload();
            },
            error: function(xhr, status, error) {
                console.error('Error adding score:', error);
                // Handle error (e.g., display an error message to the user)
            }
        });
    });

    $('#changeUsername').click(function() {
        fetchUsernamesAndPopulateDropdown2();
        $('#changeUsernameModal').modal('show');
    });

    // Function to fetch usernames and populate dropdown
    function fetchUsernamesAndPopulateDropdown2() {
        $.get('/api/players', function(players) {
            const dropdown = $('#usernameOld');
            dropdown.empty(); // Clear existing options
            dropdown.append($('<option>').attr('value', '').text('Select an existing username')); // Add default option
            players.forEach(function(player) {
                dropdown.append($('<option>').attr('value', player.username).text(player.username)); // Add player username as option
            });
        });
    }

    // Submit form handler
    $('#changeUsernameForm').submit(function(event) {
        event.preventDefault(); // Prevent the form from submitting normally

        // Get form data
        const formData = {
            existingUsername: $('#usernameOld').val(),
            newUsername: $('#newUsername').val()
        };

        // Send the form data to the server to change the username
        $.ajax({
            type: 'PUT',
            url: '/api/players',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(response) {
                console.log('Username changed successfully:', response);
                // Close the modal
                $('#changeUsernameModal').modal('hide');
                // Clear form fields
                $('#changeUsernameForm')[0].reset();

                location.reload();
            },
            error: function(xhr, status, error) {
                console.error('Error changing username:', error);
                // Handle error (e.g., display an error message to the user)
            }
        });
    });

    function generateTeams() {
        let teamPlayers = playersTakingPart.map(id => {
            return $.get(`/api/player/${id}`).then(player => {
                return $.get(`/api/skill/${player.id}`).then(skill => {
                    return {
                        ...player,
                        skillLevel: skill.skillLevel
                    };
                });
            });
        });

        Promise.all(teamPlayers).then(playersWithSkills => {
            playersWithSkills.sort((a, b) => b.skillLevel - a.skillLevel);

            // Distribute players into two balanced teams
            const teamA = [];
            const teamB = [];
            playersWithSkills.forEach((player, index) => {
                if (index % 2 === 0) {
                    teamA.push(player);
                } else {
                    teamB.push(player);
                }
            });

            // Populate the teams table
            const teamsTableBody = $('#teams tbody');
            teamsTableBody.empty();
            const maxLength = Math.max(teamA.length, teamB.length);

            for (let i = 0; i < maxLength; i++) {
                if (Math.random() > 0.5) {
                    let temp = teamA[i];
                    teamA[i] = teamB[i];
                    teamB[i] = temp;
                }

                const playerA = teamA[i];
                const playerB = teamB[i];
                const row = `<tr>
                    <td>${playerA != undefined ? playerA.username : ''}</td>
                    <td>${playerB != undefined ? playerB.username : ''}</td>
                </tr>`;
                teamsTableBody.append(row);
            }
        });
    }

    $("#resetText").on("click", () => {
        $(".isPlaying").prop('checked', false);

        playersTakingPart = [];

        generateTeams();
    })

    $("#reshuffle").on("click", () => {
        generateTeams();
    })
});
