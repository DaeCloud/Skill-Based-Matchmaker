$(document).ready(function () {
  let playersTakingPart = [];
  let numTeams = 2;
  let gameSelection = 0;

  $.get("profile", function (profile) {
    if (profile.email) {
      const userInfoDiv = document.getElementById("user-info");
      userInfoDiv.innerHTML = `
            <img src="${profile.photos[0].value}" alt="Profile Picture">
            <span>${profile.displayName}</span>
        `;
    }
  });

  const logoutButton = document.getElementById("logout-button");
  logoutButton.addEventListener("click", function () {
    fetch("logout")
      .then((response) => {
        if (response.ok) {
          window.location.href = response.path; // Redirect to homepage or login page after logout
        }
      })
      .catch((error) => {
        console.error("Error during logout:", error);
      });
  });

  $.get("api/games", (games) => {
    const dropdown = $("#gameSelect");
    const customDropdown = $("#gameSelectDropdown").children("ul");
    games.sort((a, b) =>
      a.game.toLowerCase().localeCompare(b.game.toLowerCase())
    );
    dropdown.empty(); // Clear existing options
    dropdown.append($("<option>").attr("value", "0").text("Leaderboard")); // Add default option
    dropdown.append(
      $("<option>")
        .attr("value", "")
        .attr("disabled", "disabled")
        .text("------------------")
    );
    customDropdown.html("");
    customDropdown.append(
      $("<li>")
        .data("value", "#5790E6")
        .data("id", "0")
        .html("<b>Leaderboard</b> overall rankings")
    );
    games.forEach(function (game) {
      dropdown.append($("<option>").attr("value", game.id).text(game.game)); // Add player username as option
      customDropdown.append(
        $("<li>").data("value", "#5790E6").data("id", game.id).html(game.game)
      );
    });

    $(".dropdown ul li").click(function () {
      $(".dropdown ul li").each(function () {
        if ($(this).hasClass("selected")) {
          $(this).removeClass("selected");
        }
      });
      $(this).addClass("selected");
      $("#gameSelect").val($(this).data("id"));
      $(".dropdown h1")
        .html($(this).html())
        .removeClass()
        .addClass("selected-" + ($(this).index() + 1));

      gameSelection = parseInt($(this).data("id"));
      fetchPlayers(parseInt($(this).data("id")));
      generateTeams();
    });
  });

  $("#gameSelect").on("change", (e) => {
    const gameId = parseInt($(e.currentTarget).val());
    gameSelection = gameId;
    playersTakingPart = [];
    $("#teams tbody").empty();
    if (gameId === 0) {
      $("#rankingHeadingToChange").text("Points");
    } else {
      $("#rankingHeadingToChange").text("Skill Level");
    }
    fetchPlayers(gameId);
  });

  function fetchPlayers(gameId) {
    if (gameId !== 0) {
      // Fetch all players
      $.get("api/players", function (players) {
        // Fetch skill levels for each player
        const skillRequests = players.map((player) => {
          return $.get(`api/skill/${player.id}/${gameId}`).then((skill) => {
            return {
              ...player,
              skillLevel: skill.skillLevel,
            };
          });
        });

        // Wait for all skill level requests to complete
        Promise.all(skillRequests).then((playersWithSkills) => {
          // Sort players by skill level (descending)
          playersWithSkills.sort((a, b) => b.skillLevel - a.skillLevel);

          // Populate the rankings table
          const rankingsTableBody = $("#rankings tbody");
          rankingsTableBody.empty();
          playersWithSkills.forEach((player, index) => {
            const row = `<tr>
                    <th scope="row" class="positionInRanks">${
                      player.skillLevel === 0 ? "-" : index + 1
                    }</th>
                    <td>${player.username}</td>
                    <td>${player.firstName} ${player.lastName}</td>
                    <td>${player.skillLevel.toFixed(2) || 0}</td>
                    <td>
                        <input type="checkbox" class="isPlaying" data-player-id="${
                          player.id
                        }" style="display: none;" />
                        <i class="fa-solid fa-xmark" id="icon"></i> <span id="team-${
                          player.id
                        }"></span>
                    </td>
                </tr>`;
            rankingsTableBody.append(row);
          });

          $(".isPlaying").on("change", (e) => {
            let playerId = $(e.currentTarget).data("player-id");
            let row = $(e.currentTarget).closest("tr");
            let icon = $(e.currentTarget).closest("#icon");
            let value = e.currentTarget.checked;

            if (value) {
              playersTakingPart.push(playerId);
              row.addClass("player-selected");
              row.addClass("table-success");
              icon.addClass("fa-check");
              icon.removeClass("fa-xmark");
            } else {
              const index = playersTakingPart.indexOf(playerId);

              if (index !== -1) {
                playersTakingPart.splice(index, 1);
              }

              row.removeClass("player-selected");
              row.removeClass("table-success");
              icon.removeClass("fa-check");
              icon.addClass("fa-xmark");
            }

            generateTeams();
          });

          $("#rankings tbody tr").on("click", (e) => {
            let input = $($(e.currentTarget).children()[4]).children()[0];
            input.checked = !input.checked;

            let playerId = $(input).data("player-id");
            let row = $(input).closest("tr");
            let icon = $(input).parent().children("i");
            let value = input.checked;

            if (value) {
              playersTakingPart.push(playerId);
              row.addClass("player-selected");
              row.addClass("table-success");
              icon.addClass("fa-check");
              icon.removeClass("fa-xmark");
            } else {
              const index = playersTakingPart.indexOf(playerId);

              if (index !== -1) {
                playersTakingPart.splice(index, 1);
              }

              row.removeClass("player-selected");
              row.removeClass("table-success");
              icon.removeClass("fa-check");
              icon.addClass("fa-xmark");

              $(`#team-${playerId}`).text("");
            }

            generateTeams();
          });
        });
      });
    } else {
      // Get Leaderboard
      $.get("api/leaderboard", function (players) {
        // Populate the rankings table
        const rankingsTableBody = $("#rankings tbody");
        rankingsTableBody.empty();
        players.forEach((player, index) => {
          const row = `<tr>
              <th scope="row" class="positionInRanks">${
                player.points == 0 ? "-" : index + 1
              }</th>
              <td>${player.username}</td>
              <td>${player.firstName} ${player.lastName}</td>
              <td>${player.points || 0}</td>
              <td>
                  <input type="checkbox" class="isPlaying" data-player-id="${
                    player.id
                  }" style="display: none;" />
                  <i class="fa-solid fa-xmark" id="icon"></i> <span id="team-${
                    player.id
                  }"></span>
              </td>
          </tr>`;
          rankingsTableBody.append(row);
        });

        $(".isPlaying").on("change", (e) => {
          let playerId = $(e.currentTarget).data("player-id");
          let row = $(e.currentTarget).closest("tr");
          let icon = $(e.currentTarget).closest("#icon");
          let value = e.currentTarget.checked;

          if (value) {
            playersTakingPart.push(playerId);
            row.addClass("player-selected");
            row.addClass("table-success");
            icon.addClass("fa-check");
            icon.removeClass("fa-xmark");
          } else {
            const index = playersTakingPart.indexOf(playerId);

            if (index !== -1) {
              playersTakingPart.splice(index, 1);
            }

            row.removeClass("player-selected");
            row.removeClass("table-success");
            icon.removeClass("fa-check");
            icon.addClass("fa-xmark");
          }

          generateTeams();
        });

        $("#rankings tbody tr").on("click", (e) => {
          let input = $($(e.currentTarget).children()[4]).children()[0];
          input.checked = !input.checked;

          let playerId = $(input).data("player-id");
          let row = $(input).closest("tr");
          let icon = $(input).parent().children("i");
          let value = input.checked;

          if (value) {
            playersTakingPart.push(playerId);
            row.addClass("player-selected");
            row.addClass("table-success");
            icon.addClass("fa-check");
            icon.removeClass("fa-xmark");
          } else {
            const index = playersTakingPart.indexOf(playerId);

            if (index !== -1) {
              playersTakingPart.splice(index, 1);
            }

            row.removeClass("player-selected");
            row.removeClass("table-success");
            icon.removeClass("fa-check");
            icon.addClass("fa-xmark");

            $(`#team-${playerId}`).text("");
          }

          generateTeams();
        });
      });
    }
  }

  fetchPlayers(gameSelection);

  // Show the modal when the "Add Player" button is clicked
  $("#addPlayer").click(function () {
    $("#addPlayerModal").modal("show");
  });

  // Submit form handler
  $("#addPlayerForm").submit(function (event) {
    event.preventDefault(); // Prevent the form from submitting normally

    // Get form data
    const formData = {
      firstName: $("#firstName").val(),
      lastName: $("#lastName").val(),
      username: $("#username").val(),
    };

    // Send the form data to the server to add a new player
    $.ajax({
      type: "POST",
      url: "api/players",
      contentType: "application/json",
      data: JSON.stringify(formData),
      success: function (response) {
        console.log("Player added successfully:", response);
        // Close the modal
        $("#addPlayerModal").modal("hide");
        // Clear form fields
        $("#addPlayerForm")[0].reset();
        // Refresh the page to update player rankings (you may implement a more efficient way to update the UI)
        fetchPlayers(gameSelection);
        generateTeams();
      },
      error: function (xhr, status, error) {
        console.error("Error adding player:", error);
        // Handle error (e.g., display an error message to the user)
      },
    });
  });

  // Show the modal when the "Add Score" button is clicked
  $("#addScore").click(function () {
    fetchUsernamesAndPopulateDropdown();
    $("#addScoreModal").modal("show");
  });

  // Function to fetch usernames and populate dropdown
  function fetchUsernamesAndPopulateDropdown() {
    $.get("api/players", function (players) {
      const dropdown = $("#playerIdScore");
      players.sort((a, b) =>
        a.username.toLowerCase().localeCompare(b.username.toLowerCase())
      );
      dropdown.empty(); // Clear existing options
      dropdown.append($("<option>").attr("value", "").text("Select a player")); // Add default option
      players.forEach(function (player) {
        dropdown.append(
          $("<option>").attr("value", player.id).text(player.username)
        ); // Add player username as option
      });
    });

    $.get("api/games", function (games) {
      const dropdown = $("#gameIdScore");
      games.sort((a, b) =>
        a.game.toLowerCase().localeCompare(b.game.toLowerCase())
      );
      dropdown.empty(); // Clear existing options
      dropdown.append($("<option>").attr("value", "").text("Select a game")); // Add default option
      games.forEach(function (game) {
        dropdown.append($("<option>").attr("value", game.id).text(game.game)); // Add player username as option
      });
    });
  }

  // Submit form handler
  $("#addScoreForm").submit(function (event) {
    event.preventDefault(); // Prevent the form from submitting normally

    // Get form data
    const formData = {
      value: $("#value").val(),
      game: $("#gameIdScore").val(),
    };

    let playerId = $("#playerIdScore").val();

    // Send the form data to the server to add a new score
    $.ajax({
      type: "POST",
      url: `api/scores/${playerId}`,
      contentType: "application/json",
      data: JSON.stringify(formData),
      success: function (response) {
        console.log("Score added successfully:", response);
        // Close the modal
        $("#addScoreModal").modal("hide");
        // Clear form fields
        $("#addScoreForm")[0].reset();

        fetchPlayers(gameSelection);
        generateTeams();
      },
      error: function (xhr, status, error) {
        console.error("Error adding score:", error);
        // Handle error (e.g., display an error message to the user)
      },
    });
  });

  $("#addGame").click(function () {
    $("#addGameModal").modal("show");
  });

  $("#addGameForm").submit(function (event) {
    event.preventDefault(); // Prevent the form from submitting normally

    // Get form data
    const formData = {
      game: $("#gameName").val(),
    };

    // Send the form data to the server to add a new score
    $.ajax({
      type: "POST",
      url: `api/games`,
      contentType: "application/json",
      data: JSON.stringify(formData),
      success: function (response) {
        console.log("Game added successfully:", response);
        // Close the modal
        $("#addGameModal").modal("hide");
        // Clear form fields
        $("#addGameForm")[0].reset();

        fetchPlayers(gameSelection);
        generateTeams();
      },
      error: function (xhr, status, error) {
        console.error("Error adding game:", error);
        // Handle error (e.g., display an error message to the user)
      },
    });
  });

  $("#changeUsername").click(function () {
    fetchUsernamesAndPopulateDropdown2();
    $("#changeUsernameModal").modal("show");
  });

  // Function to fetch usernames and populate dropdown
  function fetchUsernamesAndPopulateDropdown2() {
    $.get("api/players", function (players) {
      const dropdown = $("#usernameOld");
      dropdown.empty(); // Clear existing options
      dropdown.append(
        $("<option>").attr("value", "").text("Select an existing username")
      ); // Add default option
      players.forEach(function (player) {
        dropdown.append(
          $("<option>").attr("value", player.username).text(player.username)
        ); // Add player username as option
      });
    });
  }

  // Submit form handler
  $("#changeUsernameForm").submit(function (event) {
    event.preventDefault(); // Prevent the form from submitting normally

    // Get form data
    const formData = {
      existingUsername: $("#usernameOld").val(),
      newUsername: $("#newUsername").val(),
    };

    // Send the form data to the server to change the username
    $.ajax({
      type: "PUT",
      url: "api/players",
      contentType: "application/json",
      data: JSON.stringify(formData),
      success: function (response) {
        console.log("Username changed successfully:", response);
        // Close the modal
        $("#changeUsernameModal").modal("hide");
        // Clear form fields
        $("#changeUsernameForm")[0].reset();

        fetchPlayers(gameSelection);
        generateTeams();
      },
      error: function (xhr, status, error) {
        console.error("Error changing username:", error);
        // Handle error (e.g., display an error message to the user)
      },
    });
  });

  function generateTeams() {
    let teamPlayers = playersTakingPart.map((id) => {
      return $.get(`api/player/${id}`).then((player) => {
        return $.get(`api/skill/${player.id}/${gameSelection}`).then(
          (skill) => {
            return {
              ...player,
              skillLevel: skill.skillLevel,
            };
          }
        );
      });
    });

    Promise.all(teamPlayers).then((playersWithSkills) => {
      playersWithSkills.sort((a, b) => b.skillLevel - a.skillLevel);

      if (numTeams == 2) {
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
        const teamsTableBody = $("#teams tbody");
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
                    <td class="table-primary">${
                      playerA != undefined ? playerA.username : ""
                    }</td>
                    <td class="table-danger">${
                      playerB != undefined ? playerB.username : ""
                    }</td>
                </tr>`;
          teamsTableBody.append(row);
          if (playerA) {
            $(`#team-${playerA.id}`).text("Team A");
            $(`#team-${playerA.id}`).css("color", "blue");
          }

          if (playerB) {
            $(`#team-${playerB.id}`).text("Team B");
            $(`#team-${playerB.id}`).css("color", "red");
          }
        }
      } else if (numTeams == 3) {
        // Distribute players into two balanced teams
        const teamA = [];
        const teamB = [];
        const teamC = [];
        playersWithSkills.forEach((player, index) => {
          if (index % 3 === 0) {
            teamA.push(player);
          } else if (index % 3 === 1) {
            teamB.push(player);
          } else if (index % 3 === 2) {
            teamC.push(player);
          }
        });

        // Populate the teams table
        const teamsTableBody = $("#teams tbody");
        teamsTableBody.empty();
        const maxLength = Math.max(teamA.length, teamB.length, teamC.length);

        for (let i = 0; i < maxLength; i++) {
          let tempArr = [teamA[i], teamB[i], teamC[i]];
          tempArr = tempArr.sort(() => Math.random() - 0.5);
          teamA[i] = tempArr[0];
          teamB[i] = tempArr[1];
          teamC[i] = tempArr[2];

          const playerA = teamA[i];
          const playerB = teamB[i];
          const playerC = teamC[i];

          const row = `<tr>
                    <td class="table-primary">${
                      playerA != undefined ? playerA.username : ""
                    }</td>
                    <td class="table-success">${
                      playerB != undefined ? playerB.username : ""
                    }</td>
                    <td class="table-danger">${
                      playerC != undefined ? playerC.username : ""
                    }</td>
                </tr>`;
          teamsTableBody.append(row);
          if (playerA) {
            $(`#team-${playerA.id}`).text("Team A");
            $(`#team-${playerA.id}`).css("color", "blue");
          }

          if (playerB) {
            $(`#team-${playerB.id}`).text("Team B");
            $(`#team-${playerB.id}`).css("color", "green");
          }

          if (playerC) {
            $(`#team-${playerC.id}`).text("Team C");
            $(`#team-${playerC.id}`).css("color", "red");
          }
        }
      } else if (numTeams == 4) {
        // Distribute players into two balanced teams
        const teamA = [];
        const teamB = [];
        const teamC = [];
        const teamD = [];
        playersWithSkills.forEach((player, index) => {
          if (index % 4 === 0) {
            teamA.push(player);
          } else if (index % 4 === 1) {
            teamB.push(player);
          } else if (index % 4 === 2) {
            teamC.push(player);
          } else if (index % 4 === 3) {
            teamD.push(player);
          }
        });

        // Populate the teams table
        const teamsTableBody = $("#teams tbody");
        teamsTableBody.empty();
        const maxLength = Math.max(
          teamA.length,
          teamB.length,
          teamC.length,
          teamD.length
        );

        for (let i = 0; i < maxLength; i++) {
          let tempArr = [teamA[i], teamB[i], teamC[i], teamD[i]];
          tempArr = tempArr.sort(() => Math.random() - 0.5);
          teamA[i] = tempArr[0];
          teamB[i] = tempArr[1];
          teamC[i] = tempArr[2];
          teamD[i] = tempArr[3];

          const playerA = teamA[i];
          const playerB = teamB[i];
          const playerC = teamC[i];
          const playerD = teamD[i];

          const row = `<tr>
                    <td class="table-primary">${
                      playerA != undefined ? playerA.username : ""
                    }</td>
                    <td class="table-success">${
                      playerB != undefined ? playerB.username : ""
                    }</td>
                    <td class="table-warning">${
                      playerC != undefined ? playerC.username : ""
                    }</td>
                    <td class="table-danger">${
                      playerD != undefined ? playerD.username : ""
                    }</td>
                </tr>`;
          teamsTableBody.append(row);
          if (playerA) {
            $(`#team-${playerA.id}`).text("Team A");
            $(`#team-${playerA.id}`).css("color", "blue");
          }

          if (playerB) {
            $(`#team-${playerB.id}`).text("Team B");
            $(`#team-${playerB.id}`).css("color", "green");
          }

          if (playerC) {
            $(`#team-${playerC.id}`).text("Team C");
            $(`#team-${playerC.id}`).css("color", "orange");
          }

          if (playerD) {
            $(`#team-${playerD.id}`).text("Team D");
            $(`#team-${playerD.id}`).css("color", "red");
          }
        }
      }
    });
  }

  $("#resetText").on("click", () => {
    $(".isPlaying").prop("checked", false);

    playersTakingPart = [];

    generateTeams();
  });

  $("#reshuffle").on("click", () => {
    generateTeams();
  });

  $("#numTeams").on("change", (e) => {
    numTeams = parseInt($(e.currentTarget).val());

    switch (numTeams) {
      case 2:
        $("#teams").html(`
          <thead>
            <tr>
              <th scope="col" class="table-primary">Team A</th>
              <th scope="col" class="table-danger">Team B</th>
            </tr>
          </thead>
          <tbody>
              <!-- Team rows will be appended here -->
          </tbody>
        `);
        break;
      case 3:
        $("#teams").html(`
          <thead>
            <tr>
              <th scope="col" class="table-primary">Team A</th>
              <th scope="col" class="table-success">Team B</th>
              <th scope="col" class="table-danger">Team C</th>
            </tr>
          </thead>
          <tbody>
              <!-- Team rows will be appended here -->
          </tbody>
        `);
        break;
      case 4:
        $("#teams").html(`
          <thead>
            <tr>
              <th scope="col" class="table-primary">Team A</th>
              <th scope="col" class="table-success">Team B</th>
              <th scope="col" class="table-warning">Team C</th>
              <th scope="col" class="table-danger">Team D</th>
            </tr>
          </thead>
          <tbody>
              <!-- Team rows will be appended here -->
          </tbody>
        `);
        break;
    }

    generateTeams();
  });

  // Function to fetch players and populate dropdown
  function populatePlayerDropdown() {
    fetch("api/players")
      .then((response) => response.json())
      .then((players) => {
        const playerSelect = document.getElementById("playerSelect");
        playerSelect.innerHTML = ""; // Clear existing options
        players.forEach((player) => {
          const option = document.createElement("option");
          option.value = player.id;
          option.textContent = `${player.firstName} ${player.lastName}`;
          playerSelect.appendChild(option);
        });
      })
      .catch((error) => {
        console.error("Error fetching players:", error);
      });
  }

  // Populate dropdown when modal is shown
  $("#deletePlayerModal").on("show.bs.modal", function () {
    populatePlayerDropdown();
  });

  // Delete player when confirm button is clicked
  document
    .getElementById("confirmDelete")
    .addEventListener("click", function () {
      const playerId = document.getElementById("playerSelect").value;
      fetch(`api/player/${playerId}`, {
        method: "DELETE",
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to delete player");
          }
          return response.json();
        })
        .then((data) => {
          console.log(data.message); // Log success message
          // Optionally, you can close the modal or update the UI
          $("#deletePlayerModal").modal("hide");

          fetchPlayers(gameSelection);
          generateTeams();
        })
        .catch((error) => {
          console.error("Error:", error.message);
          // Optionally, you can display an error message to the user
        });
    });

  $("#downloadTeamImage").on("click", (e) => {
    console.log("Getting Image...");
    const teamsHtml = $("#teams").html();
    $("#imageLoadingText").text("Generating image...");
    $("#imageLoader").css("display", "grid");
    $(".copyBtn").remove();
    $("#teamsImage").attr("src", "");

    fetch("api/teamImage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // Set the correct content type
      },
      body: JSON.stringify({
        teams: teamsHtml,
      }), // Serialize the body to JSON
    })
      .then((response) => {
        response.json().then((image) => {
          const base64Image = `data:image/png;base64,${image.image}`;
          $("#teamsImage").attr("src", base64Image);
          $("#imageLoadingText").text("");
          $("#imageLoader").css("display", "none");

          // Create a button to copy the image to the clipboard
          const copyButton = document.createElement("button");
          copyButton.classList.add("btn");
          copyButton.classList.add("btn-outline-success");
          copyButton.classList.add("mt-3");
          copyButton.classList.add("copyBtn");

          copyButton.innerText = "Copy Image to Clipboard";
          copyButton.onclick = () => {
            fetch(base64Image)
              .then((res) => res.blob())
              .then((blob) => {
                const item = new ClipboardItem({ "image/png": blob });
                navigator.clipboard.write([item]).then(
                  () => {
                    console.log("Image copied to clipboard");
                    copyButton.innerText = "Image Copied!";
                    setTimeout(() => {
                      copyButton.innerText = "Copy Image to Clipboard";
                    }, 3000);
                  },
                  (err) => {
                    console.error("Error copying image to clipboard:", err);
                  }
                );
              });
          };

          // Append the button to the document body (or any other desired location)
          $("#teamsCard").append(copyButton);
        });
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  });

  $("#burger-menu").on("click", (e) => {
    if ($("#burger-menu").hasClass("open")) {
      $("#burger-menu").removeClass("open");
      $(".navbar").css("height", "110px");
    } else {
      $("#burger-menu").addClass("open");
      $(".navbar").css("height", "390px");
    }
  });

  $(".menu-item a").on("click", (e) => {
    e.preventDefault();

    let numberTeams = $(e.currentTarget).data("value");

    $("#numTeams").val(numberTeams);
    numTeams = parseInt(numberTeams);

    switch (numTeams) {
      case 2:
        $("#teams").html(`
          <thead>
            <tr>
              <th scope="col" class="table-primary">Team A</th>
              <th scope="col" class="table-danger">Team B</th>
            </tr>
          </thead>
          <tbody>
              <!-- Team rows will be appended here -->
          </tbody>
        `);
        break;
      case 3:
        $("#teams").html(`
          <thead>
            <tr>
              <th scope="col" class="table-primary">Team A</th>
              <th scope="col" class="table-success">Team B</th>
              <th scope="col" class="table-danger">Team C</th>
            </tr>
          </thead>
          <tbody>
              <!-- Team rows will be appended here -->
          </tbody>
        `);
        break;
      case 4:
        $("#teams").html(`
          <thead>
            <tr>
              <th scope="col" class="table-primary">Team A</th>
              <th scope="col" class="table-success">Team B</th>
              <th scope="col" class="table-warning">Team C</th>
              <th scope="col" class="table-danger">Team D</th>
            </tr>
          </thead>
          <tbody>
              <!-- Team rows will be appended here -->
          </tbody>
        `);
        break;
    }

    generateTeams();
  });

  $("#1").click();

  $("input[type=radio][name=num-teams]").change((e) => {
    let number = $(e.currentTarget).val();

    numTeams = parseInt(number);

    switch (numTeams) {
      case 2:
        $("#teams").html(`
          <thead>
            <tr>
              <th scope="col" class="table-primary">Team A</th>
              <th scope="col" class="table-danger">Team B</th>
            </tr>
          </thead>
          <tbody>
              <!-- Team rows will be appended here -->
          </tbody>
        `);
        break;
      case 3:
        $("#teams").html(`
          <thead>
            <tr>
              <th scope="col" class="table-primary">Team A</th>
              <th scope="col" class="table-success">Team B</th>
              <th scope="col" class="table-danger">Team C</th>
            </tr>
          </thead>
          <tbody>
              <!-- Team rows will be appended here -->
          </tbody>
        `);
        break;
      case 4:
        $("#teams").html(`
          <thead>
            <tr>
              <th scope="col" class="table-primary">Team A</th>
              <th scope="col" class="table-success">Team B</th>
              <th scope="col" class="table-warning">Team C</th>
              <th scope="col" class="table-danger">Team D</th>
            </tr>
          </thead>
          <tbody>
              <!-- Team rows will be appended here -->
          </tbody>
        `);
        break;
    }

    generateTeams();
  });

  $("#formShareBtn").on("click", (e) => {
    e.preventDefault();
    fetch("api/share")
      .then((response) => response.json())
      .then((data) => {
        if (data.exists) {
          fetch("api/share", {
            method: "DELETE",
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.success) {
                $("#shareInput").val("Click the share button to get a link...");
                $("#formShareBtn").text("Share");
                $("#formShareBtn").removeClass("btn-danger");
                $("#formShareBtn").addClass("btn-primary");
              }
            });
          $("#shareInput").val($(location).attr("href") + "share/" + data.code);
          $("#formShareBtn").text("Unshare");
          $("#formShareBtn").removeClass("btn-primary");
          $("#formShareBtn").addClass("btn-danger");
        } else {
          fetch("api/share", {
            method: "POST",
          })
            .then((response) => response.json())
            .then((data) => {
              $("#shareInput").val(
                $(location).attr("href") + "share/" + data.code
              );
              $("#formShareBtn").text("Unshare");
              $("#formShareBtn").removeClass("btn-primary");
              $("#formShareBtn").addClass("btn-danger");
            });
        }
      });
  });

  $("#shareModal").on("show.bs.modal", function () {
    fetch("api/share")
      .then((response) => response.json())
      .then((data) => {
        if (data.exists) {
          $("#shareInput").val($(location).attr("href") + "share/" + data.code);
          $("#formShareBtn").text("Unshare");
          $("#formShareBtn").removeClass("btn-primary");
          $("#formShareBtn").addClass("btn-danger");
        } else {
          $("#shareInput").val("Click the share button to get a link...");
          $("#formShareBtn").text("Share");
          $("#formShareBtn").removeClass("btn-danger");
          $("#formShareBtn").addClass("btn-primary");
        }
      });
  });
});
